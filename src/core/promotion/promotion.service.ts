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

// Only one of these ever applies to a given order — the first one (in this order) that
// would actually have an effect wins, and the rest are skipped entirely for that order.
// BUY_TWO_GET_ONE_FREE and LOYALTY_EVERY_10TH_ITEM are not in this list: 2+1 always applies
// (to its own eligible products) independent of this check, and loyalty always stacks on
// top of whichever of these (if any) wins.
const EXCLUSIVE_PROMOTION_PRIORITY: PromotionType[] = [
  PromotionType.FIRST_ORDER_FIRST_ITEM,
  PromotionType.FREE_DELIVERY_3KM,
];

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

  // Determines which (if any) of the mutually-exclusive promotions applies to this order,
  // by priority: first-order-30% > free-delivery (i.e. free-delivery only applies when the
  // 30% discount didn't). 2+1 is not part of this — it always applies independently, and
  // its eligible products are carved out of the 30% discount's own eligibility below, since
  // a product already covered by 2+1 should never also get the 30% discount. Eligibility is
  // checked with the same rules each promotion's own handler uses, just without
  // persisting/mutating anything, so this can safely run before we know which one "wins".
  async resolveExclusivePromotion(
    userId: string,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
  ): Promise<PromotionType | null> {
    const activePromotions = await this.promotionRepo.find({ where: { isActive: true } });
    const byType = new Map(activePromotions.map((promotion) => [promotion.type, promotion]));
    const firstOrderExcludedIds = this.withBuyTwoGetOneEligibleIds(excludedProductIds, byType);

    for (const type of EXCLUSIVE_PROMOTION_PRIORITY) {
      const promotion = byType.get(type);
      if (!promotion) continue;

      const hasEffect = await this.hasExclusivePromotionEffect(
        type,
        userId,
        items,
        type === PromotionType.FIRST_ORDER_FIRST_ITEM ? firstOrderExcludedIds : excludedProductIds,
      );
      if (hasEffect) return type;
    }

    return null;
  }

  // Merges the vitamin exclusion set with whichever products are currently eligible for
  // 2+1, so callers can exclude both from the 30% discount's eligibility in one place.
  private withBuyTwoGetOneEligibleIds(
    excludedProductIds: Set<string>,
    byType: Map<PromotionType, Promotion>,
  ): Set<string> {
    const buyTwoGetOneEligibleIds = byType.get(PromotionType.BUY_TWO_GET_ONE_FREE)?.productIds ?? [];
    return new Set([...excludedProductIds, ...buyTwoGetOneEligibleIds]);
  }

  private hasExclusivePromotionEffect(
    type: PromotionType,
    userId: string,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
  ): Promise<boolean> {
    switch (type) {
      case PromotionType.FIRST_ORDER_FIRST_ITEM:
        return this.hasFirstOrderEffect(userId, items, excludedProductIds);
      case PromotionType.FREE_DELIVERY_3KM:
        return this.hasFreeDeliveryEffect(userId);
      default:
        return Promise.resolve(false);
    }
  }

  private async hasFirstOrderEffect(
    userId: string,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
  ): Promise<boolean> {
    const hasEligibleItem = items.some((item) => !excludedProductIds.has(item.productId));
    if (!hasEligibleItem) return false;

    return (await this.orderRepo.count({ where: { user: { id: userId } } })) === 0;
  }

  // "first" here means no prior *successful* (DONE) order exists yet, not just "no prior
  // order", so cancelled orders don't count.
  private async hasFreeDeliveryEffect(userId: string): Promise<boolean> {
    const hasSuccessfulOrder = await this.orderRepo.count({
      where: { user: { id: userId }, status: OrderStatus.DONE },
    });
    return hasSuccessfulOrder > 0;
  }

  // "2+1": the customer only adds the units they're paying for; we top up the cart with
  // the free unit(s) automatically instead of requiring them to add it themselves. Every
  // 2 paid units of an eligible product earns 1 free unit (e.g. 2 -> 3, 4 -> 6, 5 -> 6).
  // Always runs when active — 2+1 is not part of the cross-promotion exclusivity check
  // (see resolveExclusivePromotion), it stacks with whichever of those promotions applies.
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
  // BUY_TWO_GET_ONE_FREE and LOYALTY_EVERY_10TH_ITEM always run when active; FIRST_ORDER_FIRST_ITEM
  // only runs when it won the cross-promotion exclusivity check (see resolveExclusivePromotion),
  // and never discounts a product that's eligible for 2+1 (2+1 takes it instead).
  async computeItemDiscounts(
    userId: string,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
    exclusivePromotion: PromotionType | null,
  ): Promise<ItemDiscount[]> {
    const activePromotions = await this.promotionRepo.find({ where: { isActive: true } });
    const byType = new Map(activePromotions.map((promotion) => [promotion.type, promotion]));
    const eligiblePromotions = activePromotions.filter(
      (promotion) =>
        promotion.type === PromotionType.LOYALTY_EVERY_10TH_ITEM ||
        promotion.type === PromotionType.BUY_TWO_GET_ONE_FREE ||
        promotion.type === exclusivePromotion,
    );
    if (!eligiblePromotions.length) return [];

    const firstOrderExcludedIds = this.withBuyTwoGetOneEligibleIds(excludedProductIds, byType);

    const results = await Promise.all(
      eligiblePromotions.map((promotion) =>
        this.handlers[promotion.type](
          promotion,
          userId,
          items,
          promotion.type === PromotionType.FIRST_ORDER_FIRST_ITEM ? firstOrderExcludedIds : excludedProductIds,
        ),
      ),
    );

    return results.flat();
  }

  // A flat amount knocked off the computed delivery price ("first 3km free"): fully covers
  // deliveries cheaper than the amount, otherwise just subtracts it. Callers clamp at 0.
  // Only applies when free-delivery won the cross-promotion exclusivity check (see
  // resolveExclusivePromotion) — i.e. only when the first-order 30% discount didn't apply.
  // 2+1 is independent of this check and can apply alongside free delivery.
  async getDeliveryDiscount(
    userId: string,
    exclusivePromotion: PromotionType | null,
  ): Promise<DeliveryDiscount | null> {
    if (exclusivePromotion !== PromotionType.FREE_DELIVERY_3KM) return null;

    const promotion = await this.promotionRepo.findOne({
      where: { type: PromotionType.FREE_DELIVERY_3KM, isActive: true },
    });
    if (!promotion) return null;

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

  // 30% off the full price of every eligible line (i.e. all of them except vitamins and
  // whatever's covered by 2+1 — see excludedProductIds), not just a single item.
  private async firstOrderFirstItemDiscount(
    userId: string,
    items: OrderItemInput[],
    excludedProductIds: Set<string>,
  ): Promise<ItemDiscount[]> {
    const eligibleIndexes = items
      .map((_, itemIndex) => itemIndex)
      .filter((itemIndex) => !excludedProductIds.has(items[itemIndex].productId));
    if (!eligibleIndexes.length) return [];

    const isFirstOrder = (await this.orderRepo.count({ where: { user: { id: userId } } })) === 0;
    if (!isFirstOrder) return [];

    return eligibleIndexes.map((itemIndex) => ({
      itemIndex,
      type: PromotionType.FIRST_ORDER_FIRST_ITEM,
      discountPercent: 30,
    }));
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
