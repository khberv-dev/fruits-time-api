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
import { ServeStaticModule } from '@nestjs/serve-static';
import { StatsModule } from '@/core/stats/stats.module';
import { AssistantModule } from '@/core/assistant/assistant.module';
import { BannerModule } from '@/core/banner/banner.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(dataSource.options),
    ServeStaticModule.forRoot({
      rootPath: 'uploads',
      serveRoot: '/public',
      serveStaticOptions: {
        fallthrough: false,
      },
    }),
    AuthModule,
    UserModule,
    CatalogModule,
    ProductModule,
    BannerModule,
    StatsModule,
    AssistantModule,
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
