import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthPayload } from '@/shared/dto/auth-payload.dto';
import { AuthUser } from '@/shared/dto/auth-user.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  validate(payload: AuthPayload): AuthUser {
    return {
      id: payload.sub,
      role: payload.role,
    };
  }
}
