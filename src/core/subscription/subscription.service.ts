import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Subscription } from '@/shared/entities/subscription.entity';
import { SubscriptionCode } from '@/shared/entities/subscription-code.entity';
import { SubscriptionRedemption } from '@/shared/entities/subscription-redemption.entity';
import { Product } from '@/shared/entities/product.entity';
import { User } from '@/shared/entities/user.entity';
import { Order } from '@/shared/entities/order.entity';
import { OrderStatus } from '@/shared/enums/order-status.enum';
import { Locale } from '@/shared/enums/locale.enum';
import { businessDayRange } from '@/shared/utils/lib';
import { CreateSubscriptionRequest } from '@/core/subscription/dto/create-subscription-request.dto';
import { UpdateSubscriptionRequest } from '@/core/subscription/dto/update-subscription-request.dto';

// How many units of each listed product a subscriber gets free per business-local day.
export const DAILY_FREE_UNITS_PER_PRODUCT = 1;

// Codes are 36 characters because they're UUIDs — that gives collision-free generation
// without a retry loop, unlike the shorter referral codes.
const CODE_LENGTH = 36;

export interface SubscriptionFreeUnits {
  // Free units keyed by index into the order's item list.
  byIndex: Map<number, number>;
  // Same grant collapsed per product, for writing redemption rows.
  byProduct: { productId: string; quantity: number }[];
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionCode) private readonly codeRepo: Repository<SubscriptionCode>,
    @InjectRepository(SubscriptionRedemption) private readonly redemptionRepo: Repository<SubscriptionRedemption>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  findAll(): Promise<Subscription[]> {
    return this.subscriptionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(locale: Locale, data: CreateSubscriptionRequest): Promise<Subscription> {
    await this.assertProductsExist(data.productIds);

    return this.subscriptionRepo.save({
      title: { [locale]: data.title },
      productIds: data.productIds,
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    });
  }

  async update(id: string, locale: Locale, data: UpdateSubscriptionRequest): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException('Obuna topilmadi');
    }

    if (data.title) {
      subscription.title = { ...subscription.title, [locale]: data.title };
    }

    if (data.productIds) {
      await this.assertProductsExist(data.productIds);
      subscription.productIds = data.productIds;
    }

    if (data.isActive !== undefined) {
      subscription.isActive = data.isActive;
    }

    return this.subscriptionRepo.save(subscription);
  }

  async generateCodes(id: string, count: number): Promise<SubscriptionCode[]> {
    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException('Obuna topilmadi');
    }

    const codes = Array.from({ length: count }, () => ({ subscription, code: randomUUID() }));
    const saved = await this.codeRepo.save(codes);

    this.logger.log(`Generated ${count} code(s) for subscription ${id}`);

    return saved;
  }

  listCodes(id: string): Promise<SubscriptionCode[]> {
    return this.codeRepo.find({
      where: { subscription: { id } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  // Single-use: binding the caller to the code is what grants the entitlement. Re-redeeming
  // one's own code is a no-op rather than an error, so a retried request stays safe.
  async redeem(userId: string, code: string): Promise<Subscription> {
    if (code.length !== CODE_LENGTH) {
      throw new BadRequestException('Kod xato');
    }

    const existing = await this.codeRepo.findOne({ where: { code }, relations: ['subscription', 'user'] });
    if (!existing) {
      throw new BadRequestException('Kod topilmadi');
    }

    if (existing.user && existing.user.id !== userId) {
      throw new ConflictException('Bu kod allaqachon ishlatilgan');
    }

    if (!existing.subscription.isActive) {
      throw new BadRequestException('Bu obuna faol emas');
    }

    if (!existing.user) {
      existing.user = { id: userId } as User;
      existing.redeemedAt = new Date();
      await this.codeRepo.save(existing);
      this.logger.log(`User ${userId} redeemed a code for subscription ${existing.subscription.id}`);
    }

    return existing.subscription;
  }

  // Every subscription the user has redeemed a code for that is still switched on. A user
  // may hold several; their product lists are unioned.
  private async getActiveSubscriptions(userId: string): Promise<Subscription[]> {
    const codes = await this.codeRepo.find({
      where: { user: { id: userId }, subscription: { isActive: true } },
      relations: ['subscription'],
    });

    const byId = new Map(codes.map((entry) => [entry.subscription.id, entry.subscription]));

    return [...byId.values()];
  }

  private async getEntitledProductIds(userId: string): Promise<Set<string>> {
    const subscriptions = await this.getActiveSubscriptions(userId);

    return new Set(subscriptions.flatMap((subscription) => subscription.productIds ?? []));
  }

  // Units already taken for free today, per product. Cancelled orders are skipped so
  // cancelling an order returns the day's allowance.
  private async getUsedToday(userId: string): Promise<Map<string, number>> {
    const { start, end } = businessDayRange();

    const rows = await this.redemptionRepo
      .createQueryBuilder('redemption')
      .innerJoin('redemption.order', 'order')
      .where('redemption.user_id = :userId', { userId })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .andWhere('redemption.created_at >= :start', { start })
      .andWhere('redemption.created_at < :end', { end })
      .select('redemption.product_id', 'productId')
      .addSelect('COALESCE(SUM(redemption.quantity), 0)', 'used')
      .groupBy('redemption.product_id')
      .getRawMany<{ productId: string; used: string }>();

    return new Map(rows.map((row) => [row.productId, Number(row.used)]));
  }

  // Called by OrderService for both evaluate() (nothing persisted) and create(). Returns no
  // free units for a caller without an active subscription, which is the common path.
  async computeFreeUnits(
    userId: string,
    items: { productId: string; quantity: number }[],
  ): Promise<SubscriptionFreeUnits> {
    const empty: SubscriptionFreeUnits = { byIndex: new Map(), byProduct: [] };

    const entitledProductIds = await this.getEntitledProductIds(userId);
    if (entitledProductIds.size === 0) return empty;

    const usedToday = await this.getUsedToday(userId);
    const byIndex = new Map<number, number>();
    const grantedByProduct = new Map<string, number>();

    items.forEach((item, index) => {
      if (!entitledProductIds.has(item.productId)) return;

      // Tracked per product rather than per line so the same product split across two cart
      // entries can't claim the daily allowance twice.
      const alreadyUsed = (usedToday.get(item.productId) ?? 0) + (grantedByProduct.get(item.productId) ?? 0);
      const remaining = DAILY_FREE_UNITS_PER_PRODUCT - alreadyUsed;
      if (remaining <= 0) return;

      const free = Math.min(item.quantity, remaining);
      byIndex.set(index, free);
      grantedByProduct.set(item.productId, (grantedByProduct.get(item.productId) ?? 0) + free);
    });

    if (byIndex.size === 0) return empty;

    return {
      byIndex,
      byProduct: [...grantedByProduct].map(([productId, quantity]) => ({ productId, quantity })),
    };
  }

  // Runs inside OrderService.create's transaction, so a rolled-back order consumes nothing.
  async recordRedemptions(
    manager: EntityManager,
    userId: string,
    orderId: string,
    granted: { productId: string; quantity: number }[],
  ): Promise<void> {
    if (!granted.length) return;

    await manager.getRepository(SubscriptionRedemption).save(
      granted.map((entry) => ({
        user: { id: userId } as User,
        product: { id: entry.productId } as Product,
        order: { id: orderId } as Order,
        quantity: entry.quantity,
      })),
    );
  }

  // What the app shows a subscriber: their subscriptions plus today's remaining allowance
  // for each covered product.
  async getForUser(userId: string, locale: Locale) {
    const subscriptions = await this.getActiveSubscriptions(userId);
    if (!subscriptions.length) {
      return { subscriptions: [], products: [] };
    }

    const productIds = [...new Set(subscriptions.flatMap((subscription) => subscription.productIds ?? []))];
    const [products, usedToday] = await Promise.all([
      productIds.length ? this.productRepo.find({ where: { id: In(productIds) } }) : Promise.resolve([]),
      this.getUsedToday(userId),
    ]);

    return {
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        title: subscription.getTitle(locale),
      })),
      products: products.map((product) => ({
        ...product,
        title: product.getTitle(locale),
        description: product.getDescription(locale),
        compound: product.getCompound(locale),
        freeUnitsPerDay: DAILY_FREE_UNITS_PER_PRODUCT,
        remainingToday: Math.max(DAILY_FREE_UNITS_PER_PRODUCT - (usedToday.get(product.id) ?? 0), 0),
      })),
    };
  }

  async countUnredeemed(id: string): Promise<number> {
    return this.codeRepo.count({ where: { subscription: { id }, user: IsNull() } });
  }

  private async assertProductsExist(productIds: string[]): Promise<void> {
    const found = await this.productRepo.count({ where: { id: In(productIds) } });
    if (found !== new Set(productIds).size) {
      throw new BadRequestException('Mahsulot topilmadi');
    }
  }
}
