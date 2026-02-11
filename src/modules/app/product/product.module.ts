import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { ProductController } from '@/modules/app/product/product.controller';
import { ProductService } from '@/modules/app/product/product.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
