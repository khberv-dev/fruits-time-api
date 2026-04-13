import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from '@/shared/config/database.config';
import { AuthModule } from '@/core/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { UserModule } from '@/core/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(dataSource.options),
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
  ],
})
export class AppModule {}
