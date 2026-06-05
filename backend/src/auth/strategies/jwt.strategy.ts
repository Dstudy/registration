import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtUser } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: number;
  ma_tnv: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => req?.cookies?.access_token ?? null,
      ]),
      ignoreExpiration: false,
      // Added explicit types here to satisfy strict TypeScript rules
      secretOrKeyProvider: (
        request: Request, 
        rawJwtToken: any, 
        done: (err: any, secret?: string) => void
      ) => {
        const secret = configService.get<string>('JWT_ACCESS_SECRET');
        done(null, secret);
      },
    });
  }

  validate(payload: JwtPayload): JwtUser {
    return { id: payload.sub, ma_tnv: payload.ma_tnv, role: payload.role };
  }
}