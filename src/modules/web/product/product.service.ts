import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { Repository } from 'typeorm';
import { CreateProductRequest } from '@/modules/web/product/dto/create-product-request.dto';

@Injectable()
export class ProductService {
  constructor(@InjectRepository(Product) private readonly productRepo: Repository<Product>) {}

  getByCategory(categoryId: string) {
    if (!categoryId) {
      throw new BadRequestException();
    }

    return this.productRepo.find({
      where: {
        category: {
          id: categoryId,
        },
      },
      order: {
        createdAt: 'desc',
      },
    });
  }

  async create(fileName: string, data: CreateProductRequest) {
    await this.productRepo.save({
      title: data.title,
      price: data.price,
      image: fileName,
      category: {
        id: data.categoryId,
      },
    });

    return {
      message: 'Mahsulot yaratildi',
    };
  }
}
