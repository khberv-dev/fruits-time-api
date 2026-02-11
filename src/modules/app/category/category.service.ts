import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from '@/shared/entities/category.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CategoryService {
  constructor(@InjectRepository(Category) private readonly categoryRepo: Repository<Category>) {}

  getAll() {
    return this.categoryRepo.find({
      order: {
        createdAt: 'desc',
      },
      where: {
        isActive: true,
      },
    });
  }
}
