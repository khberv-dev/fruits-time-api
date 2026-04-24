import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { Repository } from 'typeorm';
import { Locale } from '@/shared/enums/locale.enum';
import { CreateProductRequest } from '@/core/product/dto/create-product-request.dto';
import { UpdateProductRequest } from '@/core/product/dto/update-product-request.dto';

@Injectable()
export class ProductService {
  constructor(@InjectRepository(Product) private readonly productRepo: Repository<Product>) {}

  async findAll(catalogId: string, locale: Locale, filterInactive: boolean = true) {
    const qb = this.productRepo.createQueryBuilder('p');

    if (filterInactive) {
      qb.where('p.is_active = :isActive', { isActive: true });
    }

    qb.andWhere('p.catalog_id = :catalogId', { catalogId });

    const products = await qb.getMany();

    return products.map((product) => ({
      ...product,
      title: product.getTitle(locale),
      description: product.getDescription(locale),
      compound: product.getCompound(locale),
    }));
  }

  async search(locale: Locale, search: string) {
    if (search.trim().length == 0) {
      return [];
    }

    const qb = this.productRepo.createQueryBuilder('p');

    qb.where(`p.title->>:lang ILIKE :search`, {
      lang: locale,
      search: `%${search}%`,
    });

    qb.orWhere(
      `EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(p.compound->:lang) AS elem
            WHERE elem ILIKE :search
          )`,
      {
        lang: locale,
        search: `%${search}%`,
      },
    );

    const products = await qb.getMany();

    return products.map((product) => ({
      ...product,
      title: product.getTitle(locale),
      description: product.getDescription(locale),
      compound: product.getCompound(locale),
    }));
  }

  create(catalogId: string, locale: Locale, fileName: string, data: CreateProductRequest) {
    return this.productRepo.save({
      title: { [locale]: data.title },
      description: { [locale]: data.description },
      compound: { [locale]: data.compound },
      price: data.price,
      image: fileName,
      type: data.type,
      catalog: {
        id: catalogId,
      },
    });
  }

  async update(productId: string, locale: Locale, fileName: string | null, data: UpdateProductRequest) {
    const product = await this.productRepo.findOne({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new BadRequestException('Produkt topilmadi');
    }

    if (fileName) {
      product.image = fileName;
    }

    if (data.title) {
      product.title = { ...product.title, [locale]: data.title };
    }

    if (data.description) {
      product.description = { ...product.description, [locale]: data.description };
    }

    if (data.compound) {
      product.compound = { ...product.compound, [locale]: data.compound };
    }

    if (data.price) {
      product.price = data.price;
    }

    if (data.isActive != undefined) {
      product.isActive = data.isActive;
    }

    if (data.type) {
      product.type = data.type;
    }

    return this.productRepo.save(product);
  }

  delete(productId: string) {
    return this.productRepo.delete(productId);
  }
}
