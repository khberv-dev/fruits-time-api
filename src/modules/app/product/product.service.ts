import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProductService {
  constructor(@InjectRepository(Product) private readonly productRepo: Repository<Product>) {}

  getByCategory(categoryId: string) {
    if (!categoryId) {
      throw new BadRequestException();
    }

    return this.productRepo.find({
      where: {
        isActive: true,
        category: {
          id: categoryId,
        },
      },
      order: {
        createdAt: 'desc',
      },
    });
  }
}
