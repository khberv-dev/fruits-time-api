import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '@/shared/entities/category.entity';
import { CategoryController } from '@/modules/app/category/category.controller';
import { CategoryService } from '@/modules/app/category/category.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
