import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from '@/shared/entities/category.entity';
import { Repository } from 'typeorm';
import { CreateCategoryRequest } from '@/modules/web/category/dto/create-category-request.dto';
import { UpdateCategoryRequest } from '@/modules/web/category/dto/update-category-request.dto';

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

  async update(categoryId: string, fileName: string | undefined, data: UpdateCategoryRequest) {
    await this.categoryRepo.update(categoryId, { ...data, image: fileName });

    return {
      message: "Ma'lumot yangilandi",
    };
  }
}
