import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from '@/shared/entities/promotion.entity';
import { Order } from '@/shared/entities/order.entity';
import { OrderItem } from '@/shared/entities/order-item.entity';
import { OrderStatus } from '@/shared/enums/order-status.enum';
import { PromotionType } from '@/shared/enums/promotion-type.enum';

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface ItemDiscount {
  itemIndex: number;
  type: PromotionType;
  discountPercent?: number;
  freeUnits?: number;
}

export interface LoyaltyStatus {
  isActive: boolean;
  itemsOrdered: number;
  itemsUntilNextFree: number;
}

export interface DeliveryDiscount {
  name: string;
  amount: number;
}

export interface UpdatePromotionData {
  isActive?: boolean;
  productIds?: string[];
}

const LOYALTY_INTERVAL = 10;
const BUY_TWO_GET_ONE_INTERVAL = 3;
const FREE_DELIVERY_DISCOUNT_AMOUNT = 22_000;

const PROMOTION_NAMES: Record<PromotionType, string> = {
  [PromotionType.FIRST_ORDER_FIRST_ITEM]: 'Birinchi buyurtma uchun chegirma',
  [PromotionType.LOYALTY_EVERY_10TH_ITEM]: 'Sodiqlik dasturi (har 10-mahsulot bepul)',
  [PromotionType.BUY_TWO_GET_ONE_FREE]: '2+1 aksiya (har 3-mahsulot bepul)',
  [PromotionType.FREE_DELIVERY_3KM]: 'Yetkazib berishda chegirma',
};

@Injectable()
export class PromotionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PromotionService.name);

  // Each promotion's eligibility/discount logic lives here, keyed by type.
  // The Promotion row (see promotion.entity.ts) only tracks whether admins have it enabled
  // (and, for product-scoped promotions, which products it applies to).
  private readonly handlers: Record<
    PromotionType,
    (promotion: Promotion, userId: string, items: OrderItemInput[]) => Promise<ItemDiscount[]>
  > = {
    [PromotionType.FIRST_ORDER_FIRST_ITEM]: (promotion, userId, items) =>
      this.firstOrderFirstItemDiscount(userId, items),
    [PromotionType.LOYALTY_EVERY_10TH_ITEM]: (promotion, userId, items) => this.loyaltyDiscount(userId, items),
    [PromotionType.BUY_TWO_GET_ONE_FREE]: (promotion, userId, items) => this.buyTwoGetOneFreeDiscount(promotion, items),
    // Affects the delivery quote, not order items — see getDeliveryDiscount().
    [PromotionType.FREE_DELIVERY_3KM]: () => Promise.resolve([]),
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

  async update(id: string, data: UpdatePromotionData): Promise<Promotion> {
    const promotion = await this.promotionRepo.findOne({ where: { id } });
    if (!promotion) {
      throw new NotFoundException('Aksiya topilmadi');
    }

    if (data.isActive !== undefined) promotion.isActive = data.isActive;
    if (data.productIds !== undefined) promotion.productIds = data.productIds;

    return this.promotionRepo.save(promotion);
  }

  async computeItemDiscounts(userId: string, items: OrderItemInput[]): Promise<ItemDiscount[]> {
    const activePromotions = await this.promotionRepo.find({ where: { isActive: true } });
    if (!activePromotions.length) return [];

    const results = await Promise.all(
      activePromotions.map((promotion) => this.handlers[promotion.type](promotion, userId, items)),
    );

    return results.flat();
  }

  // A flat amount knocked off the computed delivery price ("first 3km free"): fully covers
  // deliveries cheaper than the amount, otherwise just subtracts it. Callers clamp at 0.
  async getDeliveryDiscount(): Promise<DeliveryDiscount | null> {
    const promotion = await this.promotionRepo.findOne({
      where: { type: PromotionType.FREE_DELIVERY_3KM, isActive: true },
    });
    if (!promotion) return null;

    return { name: PROMOTION_NAMES[PromotionType.FREE_DELIVERY_3KM], amount: FREE_DELIVERY_DISCOUNT_AMOUNT };
  }

  getDisplayName(type: PromotionType): string {
    return PROMOTION_NAMES[type];
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

  private async firstOrderFirstItemDiscount(userId: string, items: OrderItemInput[]): Promise<ItemDiscount[]> {
    if (items.length === 0) return [];

    const isFirstOrder = (await this.orderRepo.count({ where: { user: { id: userId } } })) === 0;
    return isFirstOrder ? [{ itemIndex: 0, type: PromotionType.FIRST_ORDER_FIRST_ITEM, discountPercent: 30 }] : [];
  }

  private async loyaltyDiscount(userId: string, items: OrderItemInput[]): Promise<ItemDiscount[]> {
    const priorCount = await this.getLifetimeItemCount(userId);
    const quantities = items.map((item) => item.quantity);

    return this.computeFreeUnitsPerItem(priorCount, quantities)
      .map((freeUnits, itemIndex) => ({ itemIndex, type: PromotionType.LOYALTY_EVERY_10TH_ITEM, freeUnits }))
      .filter((discount) => discount.freeUnits > 0);
  }

  // Every 3rd unit of an eligible product is free, counted across the whole order (not
  // per cart line), so splitting the same product across two cart entries still works.
  private buyTwoGetOneFreeDiscount(promotion: Promotion, items: OrderItemInput[]): Promise<ItemDiscount[]> {
    const eligibleProductIds = new Set(promotion.productIds ?? []);
    if (eligibleProductIds.size === 0) return Promise.resolve([]);

    const cumulativeByProduct = new Map<string, number>();
    const discounts: ItemDiscount[] = [];

    items.forEach((item, itemIndex) => {
      if (!eligibleProductIds.has(item.productId)) return;

      let cumulative = cumulativeByProduct.get(item.productId) ?? 0;
      let freeUnits = 0;
      for (let i = 0; i < item.quantity; i++) {
        cumulative++;
        if (cumulative % BUY_TWO_GET_ONE_INTERVAL === 0) freeUnits++;
      }
      cumulativeByProduct.set(item.productId, cumulative);

      if (freeUnits > 0) {
        discounts.push({ itemIndex, type: PromotionType.BUY_TWO_GET_ONE_FREE, freeUnits });
      }
    });

    return Promise.resolve(discounts);
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
