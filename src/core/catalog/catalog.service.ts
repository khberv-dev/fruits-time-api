import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Catalog } from '@/shared/entities/catalog.entity';
import { Repository } from 'typeorm';
import { Locale } from '@/shared/enums/locale.enum';
import { CreateCatalogRequest } from '@/core/catalog/dto/create-catalog-request.dto';
import { UpdateCatalogRequest } from '@/core/catalog/dto/update-catalog-request.dto';

@Injectable()
export class CatalogService {
  constructor(@InjectRepository(Catalog) private readonly catalogRepo: Repository<Catalog>) {}

  async findAll(locale: Locale, filterInactive: boolean = true) {
    const qb = this.catalogRepo
      .createQueryBuilder('c')
      .leftJoin('c.products', 'p')
      .addSelect('COUNT(p.id)', 'productsCount');

    if (filterInactive) {
      qb.where('c.is_active = :isActive', { isActive: true });
    }

    qb.groupBy('c.id');

    const { entities: catalogs, raw } = await qb.getRawAndEntities();

    return catalogs.map((catalog, index) => ({
      ...catalog,
      title: catalog.title[locale],
      productsCount: raw[index]['productsCount'],
    }));
  }

  create(locale: Locale, fileName: string, data: CreateCatalogRequest) {
    return this.catalogRepo.save({
      title: { [locale]: data.title },
      image: fileName,
    });
  }

  async update(catalogId: string, locale: Locale, fileName: string | null, data: UpdateCatalogRequest) {
    const catalog = await this.catalogRepo.findOne({
      where: {
        id: catalogId,
      },
    });

    if (!catalog) {
      throw new BadRequestException('Katalog topilmadi');
    }

    if (fileName) {
      catalog.image = fileName;
    }

    if (data.title) {
      catalog.title = { ...catalog.title, [locale]: data.title };
    }

    return this.catalogRepo.save(catalog);
  }

  async delete(catalogId: string) {
    const catalog = await this.catalogRepo.findOne({
      where: {
        id: catalogId,
      },
      relations: ['products'],
    });

    if (!catalog || catalog.products.length > 0) {
      throw new BadRequestException("Katalog bo'sh emas");
    }

    return this.catalogRepo.delete(catalogId);
  }
}
