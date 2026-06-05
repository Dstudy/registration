import {
  Injectable,
  UnauthorizedException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByMaTnv(dto.ma_tnv);
    if (!user) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác');
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác');
    }

    return this.issueTokens(user);
  }

  async refreshTokens(userId: number, refreshToken: string) {
    const storedHash = await this.redis.get(`refresh_token:${userId}`);
    if (!storedHash) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    const isValid = await bcrypt.compare(refreshToken, storedHash);
    if (!isValid) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    // Rotate: delete old, issue new
    await this.redis.del(`refresh_token:${userId}`);

    const user = await this.usersService.findById(userId);
    if (!user || user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException('Tài khoản không khả dụng');
    }

    return this.issueTokens(user);
  }

  async logout(userId: number) {
    await this.redis.del(`refresh_token:${userId}`);
  }

  private async issueTokens(user: { id: number; ma_tnv: string; role: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      ma_tnv: user.ma_tnv,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d'),
      }),
    ]);

    // Store hashed refresh token (7d = 604800s)
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.redis.setex(`refresh_token:${user.id}`, 604800, hashedRefreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        ma_tnv: user.ma_tnv,
        role: user.role,
      },
    };
  }
}
