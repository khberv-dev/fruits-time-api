import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { Otp } from '@/shared/entities/otp.entity';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('JWT_EXPIRATION') as StringValue,
        },
      }),
    }),
    TypeOrmModule.forFeature([User, Otp]),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService],
})
export class AuthModule {}
