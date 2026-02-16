import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { Repository } from 'typeorm';
import { CreateProductRequest } from '@/modules/web/product/dto/create-product-request.dto';
import { UpdateProductRequest } from '@/modules/web/product/dto/update-product-request.dto';

@Injectable()
export class ProductService {
  constructor(@InjectRepository(Product) private readonly productRepo: Repository<Product>) {}

  get(categoryId: string) {
    return this.productRepo.find({
      where: {
        category: {
          id: categoryId,
        },
      },
      relations: ['category'],
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

  async update(productId: string, data: UpdateProductRequest) {
    await this.productRepo.update(productId, data);

    return {
      message: "Ma'lumot yangilandi",
    };
  }
}
