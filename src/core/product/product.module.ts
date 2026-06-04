import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { Branch } from '@/shared/entities/branch.entity';
import { ProductController } from '@/core/product/product.controller';
import { ProductService } from '@/core/product/product.service';
import { PosterModule } from '@/core/poster/poster.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Branch]), PosterModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
