import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from '@/shared/config/database.config';
import { AuthModule } from '@/core/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { UserModule } from '@/core/user/user.module';
import { CatalogModule } from '@/core/catalog/catalog.module';
import { ProductModule } from '@/core/product/product.module';
import { RoleGuard } from '@/common/guards/role.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(dataSource.options),
    AuthModule,
    UserModule,
    CatalogModule,
    ProductModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
  ],
})
export class AppModule {}
