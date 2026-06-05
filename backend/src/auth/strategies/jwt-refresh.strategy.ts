import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.refresh_token ?? null,
      ]),
      ignoreExpiration: false,
      // Fixed the startup crash by using a dynamic secret provider
      secretOrKeyProvider: (
        request: Request,
        rawJwtToken: any,
        done: (err: any, secret?: string) => void,
      ) => {
        const secret = configService.get<string>('JWT_REFRESH_SECRET');
        done(null, secret);
      },
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('Không tìm thấy refresh token');
    return { ...payload, refreshToken };
  }
}