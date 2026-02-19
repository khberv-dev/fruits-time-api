import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from '@/config/database.config';
import { AuthModule } from '@/modules/app/auth/auth.module';
import { UserModule } from '@/modules/app/user/user.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CategoryModule } from '@/modules/app/category/category.module';
import { CategoryWebModule } from '@/modules/web/category/category.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ProductModule } from '@/modules/app/product/product.module';
import { AuthWebModule } from '@/modules/web/auth/auth.module';
import { UserWebModule } from '@/modules/web/user/user.module';
import { ProductWebModule } from '@/modules/web/product/product.module';
import { PromotionWebModule } from '@/modules/web/promotion/promotion.module';
import { PromotionModule } from '@/modules/app/promotion/promotion.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(dataSource.options),
    ServeStaticModule.forRoot({
      rootPath: 'uploads',
      serveRoot: '/public',
    }),

    AuthModule,
    UserModule,
    CategoryModule,
    ProductModule,
    PromotionModule,

    AuthWebModule,
    UserWebModule,
    CategoryWebModule,
    ProductWebModule,
    PromotionWebModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
