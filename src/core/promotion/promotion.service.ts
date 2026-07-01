import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from '@/shared/entities/promotion.entity';
import { PromotionType } from '@/shared/enums/promotion-type.enum';

export interface PromotionContext {
  isFirstOrder: boolean;
  itemCount: number;
}

export interface ItemDiscount {
  itemIndex: number;
  discountPercent: number;
}

// Each promotion's eligibility/discount logic lives here, keyed by type.
// The Promotion row (see promotion.entity.ts) only tracks whether admins have it enabled.
const PROMOTION_HANDLERS: Record<PromotionType, (ctx: PromotionContext) => ItemDiscount | null> = {
  [PromotionType.FIRST_ORDER_FIRST_ITEM]: (ctx) =>
    ctx.isFirstOrder && ctx.itemCount > 0 ? { itemIndex: 0, discountPercent: 30 } : null,
};

@Injectable()
export class PromotionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PromotionService.name);

  constructor(@InjectRepository(Promotion) private readonly promotionRepo: Repository<Promotion>) {}

  async onApplicationBootstrap() {
    for (const type of Object.values(PromotionType)) {
      const exists = await this.promotionRepo.exists({ where: { type } });
      if (!exists) {
        await this.promotionRepo.save({ type });
        this.logger.log(`Seeded promotion ${type}`);
      }
    }
  }

  findAll(): Promise<Promotion[]> {
    return this.promotionRepo.find({ order: { type: 'ASC' } });
  }

  async setActive(id: string, isActive: boolean): Promise<Promotion> {
    const promotion = await this.promotionRepo.findOne({ where: { id } });
    if (!promotion) {
      throw new NotFoundException('Aksiya topilmadi');
    }

    promotion.isActive = isActive;
    return this.promotionRepo.save(promotion);
  }

  async computeItemDiscounts(ctx: PromotionContext): Promise<ItemDiscount[]> {
    const activePromotions = await this.promotionRepo.find({ where: { isActive: true } });

    const discounts: ItemDiscount[] = [];
    for (const promotion of activePromotions) {
      const result = PROMOTION_HANDLERS[promotion.type]?.(ctx);
      if (result) discounts.push(result);
    }

    return discounts;
  }
}
