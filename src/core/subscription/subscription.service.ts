import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { Subscription } from '@/shared/entities/subscription.entity';
import { SubscriptionCode } from '@/shared/entities/subscription-code.entity';
import { SubscriptionRedemption } from '@/shared/entities/subscription-redemption.entity';
import { SubscriptionRequest } from '@/shared/entities/subscription-request.entity';
import { SubscriptionRequestStatus } from '@/shared/enums/subscription-request-status.enum';
import { Product } from '@/shared/entities/product.entity';
import { User } from '@/shared/entities/user.entity';
import { Order } from '@/shared/entities/order.entity';
import { OrderStatus } from '@/shared/enums/order-status.enum';
import { Locale } from '@/shared/enums/locale.enum';
import { businessDayRange, businessTime } from '@/shared/utils/lib';
import { escapeHtml, TelegramService } from '@/core/notify/telegram.service';
import { TelegramUpdate } from '@/core/notify/types/telegram-update.type';
import { CreateSubscriptionRequest } from '@/core/subscription/dto/create-subscription-request.dto';
import { UpdateSubscriptionRequest } from '@/core/subscription/dto/update-subscription-request.dto';

// Codes are 36 characters because they're UUIDs — that gives collision-free generation
// without a retry loop, unlike the shorter referral codes.
const CODE_LENGTH = 36;

// Every activation expires this many days out unless an admin set something else on the
// subscription. Applied at redemption, so a subscription row left without a duration —
// including any created before the column existed — still produces a dated entitlement.
export const DEFAULT_SUBSCRIPTION_DURATION_DAYS = 30;

// Prefix of the inline button's callback_data: `<action>:<requestId>`. Kept short because
// Telegram caps callback_data at 64 bytes and a UUID already takes 36.
const ACCEPT_REQUEST_ACTION = 'subreq_accept';

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
// it's the more useful thing to tell a holder whose subscription has been switched off, and
// `expired` distinguishes an entitlement that simply ran out from one that was withdrawn.
export type SubscriptionCodeStatus = 'available' | 'redeemed_by_you' | 'redeemed' | 'inactive' | 'expired';

// A subscription the user currently holds, with the moment it lapses. `expiresAt` is null
// when the subscription has no duration set, i.e. it never expires.
interface ActiveEntitlement {
  subscription: Subscription;
  expiresAt: Date | null;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionCode) private readonly codeRepo: Repository<SubscriptionCode>,
    @InjectRepository(SubscriptionRedemption) private readonly redemptionRepo: Repository<SubscriptionRedemption>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(SubscriptionRequest) private readonly requestRepo: Repository<SubscriptionRequest>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly telegramService: TelegramService,
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
      durationDays: data.durationDays ?? DEFAULT_SUBSCRIPTION_DURATION_DAYS,
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

    // Only affects codes redeemed from here on: each code snapshots its own expiresAt at
    // redemption, so existing holders keep the window they were given.
    if (data.durationDays !== undefined) {
      subscription.durationDays = data.durationDays;
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
      const redeemedAt = new Date();

      existing.user = { id: userId } as User;
      existing.redeemedAt = redeemedAt;
      existing.expiresAt = dayjs(redeemedAt).add(this.resolveDurationDays(existing.subscription), 'day').toDate();

      await this.codeRepo.save(existing);
      this.logger.log(
        `User ${userId} redeemed a code for subscription ${existing.subscription.id}, ` +
          `expires ${existing.expiresAt.toISOString()}`,
      );
    }

    // Resolved rather than hardcoded: re-redeeming a code whose entitlement already lapsed
    // reports `expired` instead of pretending it's live.
    return this.buildCodeView(existing, this.resolveCodeStatus(existing, userId), locale);
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

    if (entry.user) {
      return this.isExpired(entry) ? 'expired' : 'redeemed_by_you';
    }

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
      // How long the entitlement will run once claimed, and — for a code already redeemed —
      // when it lapses. expiresAt is null until redemption; the countdown starts then.
      durationDays: this.resolveDurationDays(subscription),
      expiresAt: entry.expiresAt,
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

  // A subscription row without an explicit duration still activates for the default window,
  // so every activation is dated. Legacy codes redeemed before expiry existed keep their
  // null expiresAt and stay permanent — this only governs new activations.
  private resolveDurationDays(subscription: Subscription): number {
    return subscription.durationDays ?? DEFAULT_SUBSCRIPTION_DURATION_DAYS;
  }

  private isExpired(code: SubscriptionCode): boolean {
    return code.expiresAt !== null && new Date(code.expiresAt).getTime() <= Date.now();
  }

  // Every subscription the user has redeemed a code for that is still switched on and
  // hasn't run out. A user may hold several; their product lists are unioned. Holding two
  // codes for the same subscription keeps the most generous expiry — never-expiring beats
  // dated, otherwise the later date — so re-redeeming effectively extends the entitlement.
  private async getActiveSubscriptions(userId: string): Promise<ActiveEntitlement[]> {
    const codes = await this.codeRepo.find({
      where: { user: { id: userId }, subscription: { isActive: true } },
      relations: ['subscription'],
    });

    const byId = new Map<string, ActiveEntitlement>();

    for (const code of codes) {
      if (this.isExpired(code)) continue;
      const expiresAt = code.expiresAt;

      const existing = byId.get(code.subscription.id);
      const isMoreGenerous =
        !existing ||
        (existing.expiresAt !== null && (expiresAt === null || expiresAt.getTime() > existing.expiresAt.getTime()));

      if (isMoreGenerous) {
        byId.set(code.subscription.id, { subscription: code.subscription, expiresAt });
      }
    }

    return [...byId.values()];
  }

  // The covered product list and the daily budget, unioned/summed across every active
  // subscription the user holds.
  private async getEntitlement(userId: string): Promise<{ productIds: Set<string>; dailyAmount: number }> {
    const entitlements = await this.getActiveSubscriptions(userId);

    return {
      productIds: new Set(entitlements.flatMap((entry) => entry.subscription.productIds ?? [])),
      dailyAmount: entitlements.reduce((sum, entry) => sum + entry.subscription.discountAmount, 0),
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
    const entitlements = await this.getActiveSubscriptions(userId);
    if (!entitlements.length) {
      return { subscriptions: [], products: [], dailyDiscountAmount: 0, remainingToday: 0 };
    }

    const productIds = [...new Set(entitlements.flatMap((entry) => entry.subscription.productIds ?? []))];
    const dailyDiscountAmount = entitlements.reduce((sum, entry) => sum + entry.subscription.discountAmount, 0);

    const [products, usedToday] = await Promise.all([
      productIds.length ? this.productRepo.find({ where: { id: In(productIds) } }) : Promise.resolve([]),
      this.getUsedToday(userId),
    ]);

    return {
      subscriptions: entitlements.map((entry) => ({
        id: entry.subscription.id,
        title: entry.subscription.getTitle(locale),
        discountAmount: entry.subscription.discountAmount,
        durationDays: this.resolveDurationDays(entry.subscription),
        // Expired entitlements are filtered out upstream, so anything listed here is still
        // valid. Null only for legacy codes redeemed before expiry existed.
        expiresAt: entry.expiresAt,
      })),
      products: products.map((product) => this.localizeProduct(product, locale)),
      dailyDiscountAmount,
      remainingToday: Math.max(dailyDiscountAmount - usedToday, 0),
    };
  }

  // A customer asking to be signed up. Deliberately grants nothing — it's a call list, so
  // an admin still has to generate a code and hand it over. An outstanding request is
  // returned as-is rather than duplicated, so repeat taps don't spam the list.
  async createRequest(userId: string): Promise<SubscriptionRequest> {
    const outstanding = await this.requestRepo.findOne({
      where: { user: { id: userId }, status: SubscriptionRequestStatus.NEW },
    });
    // Deliberately no repost: the group already has a card for this customer.
    if (outstanding) return outstanding;

    const request = await this.requestRepo.save({
      user: { id: userId } as User,
      status: SubscriptionRequestStatus.NEW,
    });

    this.logger.log(`User ${userId} requested a subscription (${request.id})`);

    // Not awaited: the group post is an alert for staff, so Telegram being slow or down
    // must not hold up or fail the customer's request.
    void this.postRequestToGroup(request, userId).catch((error: unknown) => {
      this.logger.error(
        `postRequestToGroup failed for ${request.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return request;
  }

  private async postRequestToGroup(request: SubscriptionRequest, userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const text = [
      "🔔 <b>Obuna uchun so'rov</b>",
      '',
      `👤 Mijoz: ${escapeHtml(user.firstName)}`,
      `📞 Telefon: ${escapeHtml(this.formatPhone(user.phoneNumber))}`,
      `🕒 Sana: ${businessTime(request.createdAt).format('DD.MM.YYYY HH:mm')}`,
    ].join('\n');

    await this.telegramService.sendMessage(text, [
      [{ text: '✅ Qabul qilindi', callbackData: `${ACCEPT_REQUEST_ACTION}:${request.id}` }],
    ]);
  }

  // Handles the inline button on those group posts. Anyone in the group can press it — the
  // group's membership is the access control, since Telegram accounts aren't mapped to
  // admin users here.
  async handleTelegramCallback(update: TelegramUpdate): Promise<void> {
    const query = update.callback_query;
    if (!query) return;

    const requestId = query.data?.startsWith(`${ACCEPT_REQUEST_ACTION}:`)
      ? query.data.slice(ACCEPT_REQUEST_ACTION.length + 1)
      : null;

    if (!requestId) {
      await this.telegramService.answerCallbackQuery(query.id, "Noma'lum amal");
      return;
    }

    const request = await this.requestRepo.findOne({ where: { id: requestId }, relations: ['user'] });
    if (!request) {
      await this.telegramService.answerCallbackQuery(query.id, "So'rov topilmadi");
      return;
    }

    const alreadyAccepted = request.status === SubscriptionRequestStatus.ACCEPTED;
    if (!alreadyAccepted) {
      request.status = SubscriptionRequestStatus.ACCEPTED;
      await this.requestRepo.save(request);
      this.logger.log(`Request ${request.id} accepted from Telegram by ${query.from?.id ?? 'unknown'}`);
    }

    await this.telegramService.answerCallbackQuery(
      query.id,
      alreadyAccepted ? 'Allaqachon qabul qilingan' : 'Qabul qilindi',
    );

    // Rewrite the card without its button so the same post can't be actioned twice, and so
    // the group can see who took it.
    const chatId = query.message?.chat?.id;
    if (chatId !== undefined && query.message?.message_id !== undefined) {
      const acceptedBy = escapeHtml(query.from?.first_name ?? 'admin');
      const text = [
        "🔔 <b>Obuna uchun so'rov</b>",
        '',
        `👤 Mijoz: ${escapeHtml(request.user.firstName)}`,
        `📞 Telefon: ${escapeHtml(this.formatPhone(request.user.phoneNumber))}`,
        `🕒 Sana: ${businessTime(request.createdAt).format('DD.MM.YYYY HH:mm')}`,
        '',
        `✅ Qabul qilindi — ${acceptedBy}, ${businessTime(new Date()).format('DD.MM.YYYY HH:mm')}`,
      ].join('\n');

      await this.telegramService.editMessageText(chatId, query.message.message_id, text);
    }
  }

  private formatPhone(phoneNumber: string): string {
    return phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  }

  async listRequests(page: number, pageSize: number, status?: SubscriptionRequestStatus) {
    const [requests, total] = await this.requestRepo.findAndCount({
      where: status ? { status } : {},
      relations: ['user'],
      // Oldest first: this is a queue of people waiting to be called.
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      data: requests.map((request) => ({
        id: request.id,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        user: {
          id: request.user.id,
          firstName: request.user.firstName,
          phoneNumber: request.user.phoneNumber,
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  async updateRequestStatus(id: string, status: SubscriptionRequestStatus): Promise<SubscriptionRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException("So'rov topilmadi");
    }

    request.status = status;

    return this.requestRepo.save(request);
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
