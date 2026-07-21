import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Product } from '@/shared/entities/product.entity';
import { Branch } from '@/shared/entities/branch.entity';
import { Brackets, IsNull, Not, Repository } from 'typeorm';
import { Locale } from '@/shared/enums/locale.enum';
import { CreateProductRequest } from '@/core/product/dto/create-product-request.dto';
import { UpdateProductRequest } from '@/core/product/dto/update-product-request.dto';
import { PosterService } from '@/core/poster/poster.service';
import { ProductAvailability } from '@/shared/types/product-availability.type';
import { PromotionService } from '@/core/promotion/promotion.service';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    private readonly posterService: PosterService,
    private readonly promotionService: PromotionService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncAvailability(): Promise<void> {
    const branches = await this.branchRepo.find({ where: { storageId: Not(IsNull()), isActive: true } });
    if (!branches.length) return;

    const leftoversPerStorage = new Map<number, Map<number, boolean>>();
    for (const branch of branches) {
      leftoversPerStorage.set(branch.storageId!, await this.posterService.getStorageLeftovers(branch.storageId!));
    }

    const products = await this.productRepo.find({ where: { isActive: true } });

    let updated = 0;
    for (const product of products) {
      const available: ProductAvailability[] = branches.map((branch) => {
        const leftovers = leftoversPerStorage.get(branch.storageId!)!;
        let left = false;

        if (product.ingredients !== null && product.ingredients.length > 0) {
          left = product.ingredients.every((id) => leftovers.get(id) === true);
        } else if (product.posId !== null) {
          left = leftovers.get(product.posId) === true;
        }

        return { storage_id: branch.storageId!, left };
      });

      await this.productRepo.update(product.id, { available });
      updated++;
    }

    this.logger.log(`syncAvailability: updated ${updated} products across ${branches.length} storages`);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncIngredients(): Promise<void> {
    const products = await this.productRepo.find({
      where: { posId: Not(IsNull()) },
    });

    let updated = 0;
    for (const product of products) {
      const ingredients = await this.posterService.getProduct(product.posId);
      if (ingredients === null) continue;
      await this.productRepo.update(product.id, { ingredients });
      updated++;
    }

    if (updated) {
      this.logger.log(`syncIngredients: updated ${updated}/${products.length} products`);
    }
  }

  async findAll(catalogId: string, locale: Locale, filterInactive: boolean = true) {
    const qb = this.productRepo.createQueryBuilder('p');

    if (filterInactive) {
      qb.where('p.is_active = :isActive', { isActive: true });
    }

    qb.andWhere('p.catalog_id = :catalogId', { catalogId }).orderBy('p.index', 'ASC');

    const products = await qb.getMany();
    const promotionsByProduct = await this.promotionService.getProductPromotions(products.map((p) => p.id));

    return products.map((product) => ({
      ...product,
      title: product.getTitle(locale),
      description: product.getDescription(locale),
      compound: product.getCompound(locale),
      promotions: promotionsByProduct.get(product.id) ?? [],
    }));
  }

  async findAllPaginated(catalogId: string, locale: Locale, page: number, pageSize: number, search?: string) {
    const offset = (page - 1) * pageSize;
    const term = search?.trim();

    const qb = this.productRepo.createQueryBuilder('p').where('p.catalog_id = :catalogId', { catalogId });

    if (term) {
      qb.andWhere(
        new Brackets((qb2) => {
          qb2.where('p.title->>:lang ILIKE :search', { lang: locale, search: `%${term}%` }).orWhere(
            `EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(p.compound->:lang) AS elem
                WHERE elem ILIKE :search
              )`,
            { lang: locale, search: `%${term}%` },
          );
        }),
      );
    }

    qb.orderBy('p.index', 'ASC').skip(offset).take(pageSize);

    const [products, total] = await qb.getManyAndCount();
    const promotionsByProduct = await this.promotionService.getProductPromotions(products.map((p) => p.id));

    return {
      products: products.map((product) => ({
        ...product,
        title: product.getTitle(locale),
        description: product.getDescription(locale),
        compound: product.getCompound(locale),
        promotions: promotionsByProduct.get(product.id) ?? [],
      })),
      total,
      pages: Math.ceil(total / pageSize),
    };
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
    const promotionsByProduct = await this.promotionService.getProductPromotions(products.map((p) => p.id));

    return products.map((product) => ({
      ...product,
      title: product.getTitle(locale),
      description: product.getDescription(locale),
      compound: product.getCompound(locale),
      promotions: promotionsByProduct.get(product.id) ?? [],
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
      posId: data.posId ?? null,
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

    if (data.posId !== undefined) {
      product.posId = data.posId;
    }

    if (data.index !== undefined) {
      product.index = data.index;
    }

    return this.productRepo.save(product);
  }

  delete(productId: string) {
    return this.productRepo.delete(productId);
  }
}
