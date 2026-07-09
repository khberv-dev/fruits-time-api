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

export interface ProductPromotion {
  type: PromotionType;
  name: string;
}

const LOYALTY_INTERVAL = 10;
const BUY_TWO_GET_ONE_INTERVAL = 3;
const FREE_DELIVERY_DISCOUNT_AMOUNT = 15_000;

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
    (
      promotion: Promotion,
      userId: string,
      items: OrderItemInput[],
      excludedProductIds: Set<string>,
    ) => Promise<ItemDiscount[]>
  > = {
    [PromotionType.FIRST_ORDER_FIRST_ITEM]: (promotion, userId, items, excludedProductIds) =>
      this.firstOrderFirstItemDiscount(userId, items, excludedProductIds),
    [PromotionType.LOYALTY_EVERY_10TH_ITEM]: (promotion, userId, items, excludedProductIds) =>
      this.loyaltyDiscount(userId, items, excludedProductIds),
    [PromotionType.BUY_TWO_GET_ONE_FREE]: (promotion, userId, items, excludedProductIds) =>
      this.buyTwoGetOneFreeDiscount(promotion, items, excludedProductIds),
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

  // "2+1": the customer only adds the units they're paying for; we top up the cart with
  // the free unit(s) automatically instead of requiring them to add it themselves. Every
  // 2 paid units of an eligible product earns 1 free unit (e.g. 2 -> 3, 4 -> 6, 5 -> 6).
  // Vitamin-type products never get any promotion discount, defensively excluded here too
  // in case an admin adds one to this promotion's product list by mistake.
  async applyAutoAddedItems(items: OrderItemInput[], excludedProductIds: Set<string>): Promise<OrderItemInput[]> {
    const promotion = await this.promotionRepo.findOne({
      where: { type: PromotionType.BUY_TWO_GET_ONE_FREE, isActive: true },
    });
    const eligibleProductIds = new Set(promotion?.productIds ?? []);
    if (eligibleProductIds.size === 0) return items;

    const paidGroupSize = BUY_TWO_GET_ONE_INTERVAL - 1;

    return items.map((item) => {
      if (!eligibleProductIds.has(item.productId) || excludedProductIds.has(item.productId)) return item;

      const freeUnits = Math.floor(item.quantity / paidGroupSize);
      return freeUnits > 0 ? { ...item, quantity: item.quantity + freeUnits } : item;
    });
  }

  // `excludedProductIds` (vitamin-type products) never receive any promotion discount.
  async computeItemDiscounts(
    userId: string,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
  ): Promise<ItemDiscount[]> {
    const activePromotions = await this.promotionRepo.find({ where: { isActive: true } });
    if (!activePromotions.length) return [];

    const results = await Promise.all(
      activePromotions.map((promotion) => this.handlers[promotion.type](promotion, userId, items, excludedProductIds)),
    );

    return results.flat();
  }

  // A flat amount knocked off the computed delivery price ("first 3km free"): fully covers
  // deliveries cheaper than the amount, otherwise just subtracts it. Callers clamp at 0.
  // Withheld on the customer's first order — "first" here means no prior *successful*
  // (DONE) order exists yet, not just "no prior order", so cancelled orders don't count.
  async getDeliveryDiscount(userId: string): Promise<DeliveryDiscount | null> {
    const promotion = await this.promotionRepo.findOne({
      where: { type: PromotionType.FREE_DELIVERY_3KM, isActive: true },
    });
    if (!promotion) return null;

    const hasSuccessfulOrder = await this.orderRepo.count({
      where: { user: { id: userId }, status: OrderStatus.DONE },
    });
    if (hasSuccessfulOrder === 0) return null;

    return { name: PROMOTION_NAMES[PromotionType.FREE_DELIVERY_3KM], amount: FREE_DELIVERY_DISCOUNT_AMOUNT };
  }

  getDisplayName(type: PromotionType): string {
    return PROMOTION_NAMES[type];
  }

  // Maps each requested product to the active, product-scoped promotions it's eligible
  // for (currently just buy-two-get-one-free), for display on product listings.
  async getProductPromotions(productIds: string[]): Promise<Map<string, ProductPromotion[]>> {
    const result = new Map<string, ProductPromotion[]>();
    if (!productIds.length) return result;

    const activePromotions = await this.promotionRepo.find({ where: { isActive: true } });
    const requestedIds = new Set(productIds);

    for (const promotion of activePromotions) {
      if (!promotion.productIds?.length) continue;

      const entry: ProductPromotion = { type: promotion.type, name: this.getDisplayName(promotion.type) };
      for (const productId of promotion.productIds) {
        if (!requestedIds.has(productId)) continue;

        const existing = result.get(productId) ?? [];
        existing.push(entry);
        result.set(productId, existing);
      }
    }

    return result;
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

  private async firstOrderFirstItemDiscount(
    userId: string,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
  ): Promise<ItemDiscount[]> {
    const itemIndex = items.findIndex((item) => !excludedProductIds.has(item.productId));
    if (itemIndex === -1) return [];

    const isFirstOrder = (await this.orderRepo.count({ where: { user: { id: userId } } })) === 0;
    return isFirstOrder ? [{ itemIndex, type: PromotionType.FIRST_ORDER_FIRST_ITEM, discountPercent: 30 }] : [];
  }

  private async loyaltyDiscount(
    userId: string,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
  ): Promise<ItemDiscount[]> {
    const priorCount = await this.getLifetimeItemCount(userId);
    // Excluded (vitamin) items neither count towards the cumulative "every 10th" tally
    // nor can they ever be the free one, so they're treated as zero quantity here.
    const quantities = items.map((item) => (excludedProductIds.has(item.productId) ? 0 : item.quantity));

    return this.computeFreeUnitsPerItem(priorCount, quantities)
      .map((freeUnits, itemIndex) => ({ itemIndex, type: PromotionType.LOYALTY_EVERY_10TH_ITEM, freeUnits }))
      .filter((discount) => discount.freeUnits > 0);
  }

  // Every 3rd unit of an eligible product is free, counted across the whole order (not
  // per cart line), so splitting the same product across two cart entries still works.
  private buyTwoGetOneFreeDiscount(
    promotion: Promotion,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
  ): Promise<ItemDiscount[]> {
    const eligibleProductIds = new Set(promotion.productIds ?? []);
    if (eligibleProductIds.size === 0) return Promise.resolve([]);

    const cumulativeByProduct = new Map<string, number>();
    const discounts: ItemDiscount[] = [];

    items.forEach((item, itemIndex) => {
      if (!eligibleProductIds.has(item.productId) || excludedProductIds.has(item.productId)) return;

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
