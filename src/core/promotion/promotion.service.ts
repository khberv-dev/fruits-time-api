import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from '@/shared/entities/promotion.entity';
import { Order } from '@/shared/entities/order.entity';
import { OrderItem } from '@/shared/entities/order-item.entity';
import { OrderStatus } from '@/shared/enums/order-status.enum';
import { PromotionType } from '@/shared/enums/promotion-type.enum';

export interface ItemDiscount {
  itemIndex: number;
  discountPercent?: number;
  freeUnits?: number;
}

export interface LoyaltyStatus {
  isActive: boolean;
  itemsOrdered: number;
  itemsUntilNextFree: number;
}

const LOYALTY_INTERVAL = 10;

@Injectable()
export class PromotionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PromotionService.name);

  // Each promotion's eligibility/discount logic lives here, keyed by type.
  // The Promotion row (see promotion.entity.ts) only tracks whether admins have it enabled.
  private readonly handlers: Record<PromotionType, (userId: string, quantities: number[]) => Promise<ItemDiscount[]>> =
    {
      [PromotionType.FIRST_ORDER_FIRST_ITEM]: (userId, quantities) =>
        this.firstOrderFirstItemDiscount(userId, quantities),
      [PromotionType.LOYALTY_EVERY_10TH_ITEM]: (userId, quantities) => this.loyaltyDiscount(userId, quantities),
    };

  constructor(
    @InjectRepository(Promotion) private readonly promotionRepo: Repository<Promotion>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
  ) {}

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

  async computeItemDiscounts(userId: string, quantities: number[]): Promise<ItemDiscount[]> {
    const activePromotions = await this.promotionRepo.find({ where: { isActive: true } });
    if (!activePromotions.length) return [];

    const results = await Promise.all(
      activePromotions.map((promotion) => this.handlers[promotion.type](userId, quantities)),
    );

    return results.flat();
  }

  async getLoyaltyStatus(userId: string): Promise<LoyaltyStatus> {
    const promotion = await this.promotionRepo.findOne({ where: { type: PromotionType.LOYALTY_EVERY_10TH_ITEM } });
    const itemsOrdered = await this.getLifetimeItemCount(userId);

    return {
      isActive: promotion?.isActive ?? false,
      itemsOrdered,
      itemsUntilNextFree: LOYALTY_INTERVAL - (itemsOrdered % LOYALTY_INTERVAL),
    };
  }

  private async firstOrderFirstItemDiscount(userId: string, quantities: number[]): Promise<ItemDiscount[]> {
    if (quantities.length === 0) return [];

    const isFirstOrder = (await this.orderRepo.count({ where: { user: { id: userId } } })) === 0;
    return isFirstOrder ? [{ itemIndex: 0, discountPercent: 30 }] : [];
  }

  private async loyaltyDiscount(userId: string, quantities: number[]): Promise<ItemDiscount[]> {
    const priorCount = await this.getLifetimeItemCount(userId);

    return this.computeFreeUnitsPerItem(priorCount, quantities)
      .map((freeUnits, itemIndex) => ({ itemIndex, freeUnits }))
      .filter((discount) => discount.freeUnits > 0);
  }

  private computeFreeUnitsPerItem(priorCount: number, quantities: number[]): number[] {
    const freeUnits = new Array<number>(quantities.length).fill(0);
    let cumulative = priorCount;

    quantities.forEach((quantity, index) => {
      for (let i = 0; i < quantity; i++) {
        cumulative++;
        if (cumulative % LOYALTY_INTERVAL === 0) {
          freeUnits[index]++;
        }
      }
    });

    return freeUnits;
  }

  private async getLifetimeItemCount(userId: string): Promise<number> {
    const result = await this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .where('order.user_id = :userId', { userId })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .select('COALESCE(SUM(item.quantity), 0)', 'sum')
      .getRawOne<{ sum: string }>();

    return Number(result?.sum ?? 0);
  }
}
