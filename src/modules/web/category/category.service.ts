import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from '@/shared/entities/category.entity';
import { Repository } from 'typeorm';
import { CreateCategoryRequest } from '@/modules/web/category/dto/create-category-request.dto';

@Injectable()
export class CategoryService {
  constructor(@InjectRepository(Category) private readonly categoryRepo: Repository<Category>) {}

  async create(fileName: string, data: CreateCategoryRequest) {
    await this.categoryRepo.save({
      title: data.title,
      image: fileName,
    });

    return {
      message: 'Kategoriya yaratildi',
    };
  }

  getAll() {
    return this.categoryRepo.find({
      order: {
        createdAt: 'desc',
      },
    });
  }
}
