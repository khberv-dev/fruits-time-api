import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ReqUser } from '@/shared/types/req-user.types';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow('JWT_ACCESS_KEY'),
      ignoreExpiration: false,
    });
  }

  validate(payload: any): ReqUser {
    return {
      id: payload['sub'],
      role: payload['role'],
    };
  }
}
