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

// Codes are 36 characters because they're UUIDs — that gives collision-free generation
// without a retry loop, unlike the shorter referral codes.
const CODE_LENGTH = 36;

// A line of the order the discount can be spent against, priced after every other discount.
export interface DiscountableLine {
  productId: string;
  // Line total after promotions and the referral tier, i.e. what the customer would
  // otherwise pay for this line.
  lineTotal: number;
}

export interface SubscriptionDiscount {
  // Sum knocked off each line, keyed by index into the order's item list.
  byIndex: Map<number, number>;
  // Total consumed, which is what gets written to the ledger.
  total: number;
}

// Why a code can or can't be used right now. `inactive` outranks `redeemed_by_you` because
// it's the more useful thing to tell a holder whose subscription has been switched off.
export type SubscriptionCodeStatus = 'available' | 'redeemed_by_you' | 'redeemed' | 'inactive';

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
      discountAmount: data.discountAmount,
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

    if (data.discountAmount !== undefined) {
      subscription.discountAmount = data.discountAmount;
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
  async redeem(userId: string, code: string, locale: Locale) {
    if (code.length !== CODE_LENGTH) {
      throw new BadRequestException('Kod xato');
    }

    const existing = await this.loadCode(code);
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

    return this.buildCodeView(existing, 'redeemed_by_you', locale);
  }

  // Look up a code without consuming it, so the client can show what's on offer (and
  // whether it's still claimable) before the user commits to redeeming.
  async describeCode(userId: string, code: string, locale: Locale) {
    const entry = code.length === CODE_LENGTH ? await this.loadCode(code) : null;
    if (!entry) {
      throw new NotFoundException('Kod topilmadi');
    }

    return this.buildCodeView(entry, this.resolveCodeStatus(entry, userId), locale);
  }

  private loadCode(code: string): Promise<SubscriptionCode | null> {
    return this.codeRepo.findOne({ where: { code }, relations: ['subscription', 'user'] });
  }

  private resolveCodeStatus(entry: SubscriptionCode, userId: string): SubscriptionCodeStatus {
    if (entry.user && entry.user.id !== userId) return 'redeemed';
    if (!entry.subscription.isActive) return 'inactive';
    if (entry.user) return 'redeemed_by_you';

    return 'available';
  }

  // Shared by describeCode and redeem so the client parses one shape either way, with the
  // product ids resolved and every localized field flattened for the requested locale.
  private async buildCodeView(entry: SubscriptionCode, status: SubscriptionCodeStatus, locale: Locale) {
    const { subscription } = entry;
    const productIds = subscription.productIds ?? [];
    const products = productIds.length ? await this.productRepo.find({ where: { id: In(productIds) } }) : [];

    return {
      code: entry.code,
      subscriptionId: subscription.id,
      title: subscription.getTitle(locale),
      discountAmount: subscription.discountAmount,
      isActive: subscription.isActive,
      status,
      products: products.map((product) => this.localizeProduct(product, locale)),
    };
  }

  private localizeProduct(product: Product, locale: Locale) {
    return {
      ...product,
      title: product.getTitle(locale),
      description: product.getDescription(locale),
      compound: product.getCompound(locale),
    };
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

  // The covered product list and the daily budget, unioned/summed across every active
  // subscription the user holds.
  private async getEntitlement(userId: string): Promise<{ productIds: Set<string>; dailyAmount: number }> {
    const subscriptions = await this.getActiveSubscriptions(userId);

    return {
      productIds: new Set(subscriptions.flatMap((subscription) => subscription.productIds ?? [])),
      dailyAmount: subscriptions.reduce((sum, subscription) => sum + subscription.discountAmount, 0),
    };
  }

  // How much of today's allowance is already spent. Cancelled orders are skipped so
  // cancelling an order returns the money to the day's budget.
  private async getUsedToday(userId: string): Promise<number> {
    const { start, end } = businessDayRange();

    const row = await this.redemptionRepo
      .createQueryBuilder('redemption')
      .innerJoin('redemption.order', 'order')
      .where('redemption.user_id = :userId', { userId })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .andWhere('redemption.created_at >= :start', { start })
      .andWhere('redemption.created_at < :end', { end })
      .select('COALESCE(SUM(redemption.amount), 0)', 'used')
      .getRawOne<{ used: string }>();

    return Number(row?.used ?? 0);
  }

  async getRemainingToday(userId: string): Promise<number> {
    const [{ dailyAmount }, used] = await Promise.all([this.getEntitlement(userId), this.getUsedToday(userId)]);

    return Math.max(dailyAmount - used, 0);
  }

  // Called by OrderService for both evaluate() (nothing persisted) and create(). The budget
  // is pooled across every covered line rather than allotted per product, and is capped by
  // what those lines actually cost — it never spills onto products outside the list, so a
  // cart cheaper than the allowance simply leaves the remainder unused.
  async computeDiscount(userId: string, lines: DiscountableLine[]): Promise<SubscriptionDiscount> {
    const empty: SubscriptionDiscount = { byIndex: new Map(), total: 0 };

    const { productIds, dailyAmount } = await this.getEntitlement(userId);
    if (productIds.size === 0 || dailyAmount <= 0) return empty;

    let remaining = dailyAmount - (await this.getUsedToday(userId));
    if (remaining <= 0) return empty;

    const byIndex = new Map<number, number>();
    let total = 0;

    lines.forEach((line, index) => {
      if (remaining <= 0 || !productIds.has(line.productId) || line.lineTotal <= 0) return;

      // Whatever the line costs beyond the remaining budget is paid normally.
      const applied = Math.min(line.lineTotal, remaining);
      byIndex.set(index, applied);
      remaining -= applied;
      total += applied;
    });

    return total > 0 ? { byIndex, total } : empty;
  }

  // Runs inside OrderService.create's transaction, so a rolled-back order consumes nothing.
  async recordRedemption(manager: EntityManager, userId: string, orderId: string, amount: number): Promise<void> {
    if (amount <= 0) return;

    await manager.getRepository(SubscriptionRedemption).save({
      user: { id: userId } as User,
      order: { id: orderId } as Order,
      amount,
    });
  }

  // What the app shows a subscriber: their subscriptions, the products the daily allowance
  // can be spent on, and how much of it is left today.
  async getForUser(userId: string, locale: Locale) {
    const subscriptions = await this.getActiveSubscriptions(userId);
    if (!subscriptions.length) {
      return { subscriptions: [], products: [], dailyDiscountAmount: 0, remainingToday: 0 };
    }

    const productIds = [...new Set(subscriptions.flatMap((subscription) => subscription.productIds ?? []))];
    const dailyDiscountAmount = subscriptions.reduce((sum, subscription) => sum + subscription.discountAmount, 0);

    const [products, usedToday] = await Promise.all([
      productIds.length ? this.productRepo.find({ where: { id: In(productIds) } }) : Promise.resolve([]),
      this.getUsedToday(userId),
    ]);

    return {
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        title: subscription.getTitle(locale),
        discountAmount: subscription.discountAmount,
      })),
      products: products.map((product) => this.localizeProduct(product, locale)),
      dailyDiscountAmount,
      remainingToday: Math.max(dailyDiscountAmount - usedToday, 0),
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
