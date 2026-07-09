import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { Order } from '@/shared/entities/order.entity';
import { Product } from '@/shared/entities/product.entity';
import { User } from '@/shared/entities/user.entity';
import { Branch } from '@/shared/entities/branch.entity';
import { Address } from '@/shared/entities/address.entity';
import { Session } from '@/shared/entities/session.entity';
import { Coordinates } from '@/shared/types/coordinates.type';
import { Locale } from '@/shared/enums/locale.enum';
import { CreateOrderRequest } from '@/core/order/dto/create-order-request.dto';
import { PosterService } from '@/core/poster/poster.service';
import { DeliveryService } from '@/core/delivery/delivery.service';
import { PushService } from '@/core/notify/push.service';
import { OrderType } from '@/shared/enums/order-type.enum';
import { OrderStatus } from '@/shared/enums/order-status.enum';
import { computeUserStatus, getStatusDiscount } from '@/core/user/user.service';
import { DeliveryCreateOrderInput } from '@/core/delivery/types/delivery-create-order-input.type';
import { DeliveryWebhookBody } from '@/core/delivery/types/delivery-webhook-body.type';
import { DeliveryDiscount, ItemDiscount, OrderItemInput, PromotionService } from '@/core/promotion/promotion.service';
import { PromotionType } from '@/shared/enums/promotion-type.enum';

const DELIVERY_STAGE_MESSAGE: Record<number, string> = {
  1: 'Buyurtmangiz qabul qilindi',
  2: 'Buyurtmangiz narxi hisoblanmoqda',
  3: "Buyurtmangiz to'lovga tayyor",
  4: 'Buyurtmangiz rejalashtirildi',
  5: 'Kuryer qidirilmoqda',
  6: 'Kuryer tayinlanmoqda',
  7: 'Kuryer topildi',
  8: "Kuryer do'konga yetib keldi",
  9: 'Buyurtmangiz olinishga tayyor',
  10: 'Buyurtmangiz kuryer tomonidan qabul qilindi',
  11: 'Kuryer manzilingizga yetib keldi',
  12: 'Buyurtmangiz topshirishga tayyor',
  13: "To'lov kutilmoqda",
  14: 'Buyurtmangiz yetkazib berildi',
  15: 'Buyurtmangiz muvaffaqiyatli yakunlandi',
  16: 'Buyurtmangiz qaytarilmoqda',
  17: 'Kuryer qaytish manziliga yetib keldi',
  18: 'Buyurtmangiz qaytarishga tayyor',
  19: 'Buyurtmangiz qaytarildi',
  20: 'Buyurtmangiz qaytarish yakunlandi',
  21: 'Buyurtmangiz taksi tomonidan bekor qilindi',
  22: 'Buyurtmangiz bekor qilindi',
  23: "Buyurtmangiz to'lov bilan bekor qilindi",
  24: 'Buyurtmangiz bekor qilindi',
  25: 'Buyurtmangizda xatolik yuz berdi',
  26: 'Narxni hisoblashda xatolik yuz berdi',
  27: 'Kuryer topilmadi',
  28: 'Yetkazib berish hududidan tashqarida',
  29: 'Yetkazib berish masofasidan tashqarida',
};

function stageToOrderStatus(stage: number): OrderStatus | null {
  if (stage === 14 || stage === 15) return OrderStatus.DONE;
  return null;
}

function applyDiscount(price: number, discountPercent: number): number {
  return Math.round(price * (1 - discountPercent / 100));
}

interface PromoAggregate {
  freeUnits: number;
  freeUnitsType: PromotionType | null;
  discountPercent: number;
  discountPercentType: PromotionType | null;
}

// Multiple promotions can target the same line (e.g. a first order of 10+ units of one
// product hits both the first-order and loyalty promos), so free units and the percent
// discount are tracked separately, each keeping the type that "won" it.
function aggregatePromoByIndex(itemDiscounts: ItemDiscount[]): Map<number, PromoAggregate> {
  const map = new Map<number, PromoAggregate>();

  for (const d of itemDiscounts) {
    const existing = map.get(d.itemIndex) ?? {
      freeUnits: 0,
      freeUnitsType: null,
      discountPercent: 0,
      discountPercentType: null,
    };

    if (d.freeUnits) {
      existing.freeUnits += d.freeUnits;
      existing.freeUnitsType = d.type;
    }
    if (d.discountPercent && d.discountPercent > existing.discountPercent) {
      existing.discountPercent = d.discountPercent;
      existing.discountPercentType = d.type;
    }

    map.set(d.itemIndex, existing);
  }

  return map;
}

interface PreparedOrder {
  items: OrderItemInput[];
  branch: Branch;
  products: Product[];
  productById: Map<string, Product>;
  savedAddress: Address | null;
  addressSnapshot: Coordinates | null;
  discountPercent: number;
  promoByIndex: Map<number, PromoAggregate>;
  getItemLinePrice: (index: number, unitPrice: number, quantity: number) => number;
  getItemUnitPrice: (index: number, unitPrice: number, quantity: number) => number;
  deliveryInput: DeliveryCreateOrderInput | null;
  deliveryCost?: number;
  deliveryDiscount: DeliveryDiscount | null;
}

const POSTER_DELIVERY_BASE = { courierId: 1, processingStatus: 40 };

@Injectable()
export class OrderService {
  private readonly logger = new Logger('Order Service');

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    private readonly posterService: PosterService,
    private readonly deliveryService: DeliveryService,
    private readonly pushService: PushService,
    private readonly promotionService: PromotionService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelStaleOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { affected } = await this.orderRepo.update(
      { status: OrderStatus.CREATED, createdAt: LessThan(cutoff) },
      { status: OrderStatus.CANCELLED },
    );
    if (affected) {
      this.logger.log(`cancelStaleOrders: cancelled ${affected} orders older than 2 hours`);
    }
  }

  async getDeliveryCost(userId: string, branchId: string, addressId: string): Promise<{ cost: number }> {
    const [branch, address, user] = await Promise.all([
      this.branchRepo.findOne({ where: { id: branchId, isActive: true } }),
      this.addressRepo.findOne({ where: { id: addressId, user: { id: userId } } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    if (!branch) throw new BadRequestException('Filial topilmadi yoki faol emas');
    if (branch.lat === null || branch.long === null) throw new BadRequestException('Filial koordinatalari sozlanmagan');
    if (!branch.address) throw new BadRequestException('Filial manzili sozlanmagan');
    if (!address) throw new BadRequestException('Manzil topilmadi');
    if (!user) throw new BadRequestException('Foydalanuvchi topilmadi');

    const userPhone = user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber}`;
    const cost = await this.deliveryService.evalOrder({
      vendorOrderId: 'eval',
      items: [],
      origin: {
        location: { long: branch.long, lat: branch.lat },
        address: branch.address,
        client: { phone: branch.managerPhone ?? 'Belgilanmagan', name: branch.managerName ?? 'Belgilanmagan' },
      },
      destination: {
        location: { long: address.long, lat: address.lat },
        address: address.name,
        client: { phone: userPhone, name: user.firstName },
      },
    });

    if (cost === null) throw new InternalServerErrorException('Yetkazib berish narxini hisoblashda xatolik');
    return { cost };
  }

  async evaluate(userId: string, locale: Locale, data: CreateOrderRequest) {
    const prepared = await this.prepareOrder(userId, locale, data);
    const { productById, discountPercent, promoByIndex, getItemLinePrice, deliveryCost, deliveryDiscount } = prepared;

    let subtotal = 0;
    let total = 0;

    const items = prepared.items.map((item, index) => {
      const product = productById.get(item.productId)!;
      const lineTotal = product.price * item.quantity;
      const price = getItemLinePrice(index, product.price, item.quantity);
      subtotal += lineTotal;
      total += price;

      return {
        productId: product.id,
        title: product.getTitle(locale),
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal,
        price,
      };
    });

    const discounts = this.buildDiscountBreakdown(prepared.items, productById, promoByIndex, discountPercent);
    if (deliveryDiscount) discounts.push(deliveryDiscount);

    return {
      items,
      subtotal,
      discounts,
      discountTotal: subtotal - total,
      deliveryCost: deliveryCost ?? null,
      total: total + (deliveryCost ?? 0),
    };
  }

  async create(userId: string, locale: Locale, data: CreateOrderRequest) {
    const activeOrder = await this.orderRepo.findOne({ where: { user: { id: userId }, status: OrderStatus.CREATED } });
    if (activeOrder) throw new BadRequestException('Sizda allaqachon faol buyurtma mavjud');

    const {
      items,
      branch,
      products,
      productById,
      addressSnapshot,
      deliveryInput,
      deliveryCost,
      getItemLinePrice,
      getItemUnitPrice,
    } = await this.prepareOrder(userId, locale, data);

    // Save the order, call POS, and (if delivery) call the delivery service in
    // a single transaction so any external failure rolls back the DB row.
    const order = await this.orderRepo.manager.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);

      const inserted = await orderRepo.save({
        user: { id: userId } as User,
        type: data.type,
        address: addressSnapshot,
        items: items.map((item, index) => {
          const product = productById.get(item.productId)!;
          const lineTotal = product.price * item.quantity;
          return {
            product: { id: item.productId } as Product,
            quantity: item.quantity,
            price: getItemLinePrice(index, product.price, item.quantity),
            actualPrice: lineTotal,
          };
        }),
      });

      const order = await orderRepo.findOneOrFail({
        where: { id: inserted.id },
        relations: ['items', 'items.product'],
      });

      order.posId = await this.sendToPoster(
        userId,
        products,
        items,
        data.type,
        branch.posId,
        getItemUnitPrice,
        deliveryCost,
      );
      order.deliveryCost = deliveryCost ?? null;

      if (data.type === OrderType.DELIVERY && deliveryInput) {
        order.deliveryPayload = { ...deliveryInput, vendorOrderId: order.id, deliveryCost };
      }

      await orderRepo.save(order);

      return order;
    });

    return this.mapOrder(order, locale);
  }

  // Shared by create() and evaluate(): validates the branch/products/address and
  // computes per-line pricing (referral-tier + promotion discounts, delivery quote).
  private async prepareOrder(userId: string, locale: Locale, data: CreateOrderRequest): Promise<PreparedOrder> {
    const items = await this.promotionService.applyAutoAddedItems(data.items);
    const productIds = [...new Set(items.map((item) => item.productId))];

    const products = await this.productRepo.find({ where: { id: In(productIds), isActive: true } });
    const branch = await this.branchRepo.findOne({ where: { id: data.branchId, isActive: true } });

    if (products.length !== productIds.length) {
      throw new BadRequestException("Mahsulot topilmadi yoki sotuvda yo'q");
    }

    if (!branch) {
      throw new BadRequestException('Filial topilmadi yoki faol emas');
    }

    if (!branch.isWorking) {
      throw new BadRequestException('Filial hozirda buyurtma qabul qilmayapti');
    }

    if (branch.storageId !== null) {
      const unavailable = products.filter((p) => !p.available?.some((a) => a.storage_id === branch.storageId && a.left));
      if (unavailable.length) {
        throw new BadRequestException(
          `Quyidagi mahsulotlar filialda mavjud emas: ${unavailable.map((p) => p.getTitle(locale)).join(', ')}`,
        );
      }
    }

    let savedAddress: Address | null = null;
    if (data.addressId) {
      savedAddress = await this.addressRepo.findOne({
        where: { id: data.addressId, user: { id: userId } },
      });
      if (!savedAddress) {
        throw new BadRequestException('Manzil topilmadi');
      }
    }

    if (data.type === OrderType.DELIVERY && !savedAddress) {
      throw new BadRequestException("Yetkazib berish uchun manzil ko'rsatilishi shart");
    }

    const addressSnapshot: Coordinates | null = savedAddress
      ? { long: savedAddress.long, lat: savedAddress.lat }
      : null;

    const referralCount = await this.userRepo.count({ where: { referredBy: { id: userId } } });
    const discountPercent = getStatusDiscount(computeUserStatus(referralCount));

    const itemDiscounts = await this.promotionService.computeItemDiscounts(userId, items);
    const promoByIndex = aggregatePromoByIndex(itemDiscounts);

    // Combines the referral-tier discount with any promotion for this line: promo-free
    // units are dropped from the billable quantity, remaining units get the better discount.
    const getItemLinePrice = (index: number, unitPrice: number, quantity: number): number => {
      const promo = promoByIndex.get(index);
      const paidQuantity = Math.max(quantity - (promo?.freeUnits ?? 0), 0);
      const itemDiscountPercent = Math.max(discountPercent, promo?.discountPercent ?? 0);
      return applyDiscount(unitPrice * paidQuantity, itemDiscountPercent);
    };
    const getItemUnitPrice = (index: number, unitPrice: number, quantity: number): number =>
      quantity > 0 ? Math.round(getItemLinePrice(index, unitPrice, quantity) / quantity) : 0;

    const productById = new Map(products.map((product) => [product.id, product]));

    let deliveryInput: DeliveryCreateOrderInput | null = null;
    let deliveryCost: number | undefined;
    let deliveryDiscount: DeliveryDiscount | null = null;

    if (data.type === OrderType.DELIVERY && savedAddress) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) throw new InternalServerErrorException('Foydalanuvchi topilmadi');
      if (branch.long === null || branch.lat === null)
        throw new InternalServerErrorException('Filial koordinatalari sozlanmagan');
      if (!branch.address) throw new InternalServerErrorException('Filial manzili sozlanmagan');

      const userPhone = user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber}`;
      const originClient = {
        phone: branch.managerPhone ?? 'Belgilanmagan',
        name: branch.managerName ?? 'Belgilanmagan',
      };
      const destinationClient = { phone: userPhone, name: user.firstName };

      deliveryInput = {
        vendorOrderId: '',
        items: items.map((item, index) => {
          const product = productById.get(item.productId)!;
          return {
            name: product.getTitle(locale),
            price_per_unit: getItemUnitPrice(index, product.price, item.quantity),
            quantity: item.quantity,
            width: 10,
            height: 10,
            length: 10,
            weight: 10,
          };
        }),
        origin: { location: { long: branch.long, lat: branch.lat }, address: branch.address, client: originClient },
        destination: {
          location: { long: savedAddress.long, lat: savedAddress.lat },
          address: savedAddress.name,
          client: destinationClient,
        },
      };

      const evaluated = await this.deliveryService.evalOrder({ ...deliveryInput, vendorOrderId: 'eval' });
      deliveryCost = evaluated ?? undefined;

      // "3km free delivery": flat amount off the quote, floored at 0 rather than going negative.
      if (deliveryCost !== undefined) {
        const discount = await this.promotionService.getDeliveryDiscount();
        if (discount) {
          const amount = Math.min(deliveryCost, discount.amount);
          deliveryCost -= amount;
          deliveryDiscount = { name: discount.name, amount };
        }
      }
    }

    return {
      items,
      branch,
      products,
      productById,
      savedAddress,
      addressSnapshot,
      discountPercent,
      promoByIndex,
      getItemLinePrice,
      getItemUnitPrice,
      deliveryInput,
      deliveryCost,
      deliveryDiscount,
    };
  }

  // Attributes the money saved per line to the discount that produced it (referral tier
  // vs. a specific promotion), so evaluate() can show the user a "name + amount" breakdown.
  // Fully-free units (loyalty, buy-two-get-one-free) are counted, not priced out per type,
  // and rolled into a single "Bonus mahsulotlar" entry with `amount` = number of free units.
  private buildDiscountBreakdown(
    items: OrderItemInput[],
    productById: Map<string, Product>,
    promoByIndex: Map<number, PromoAggregate>,
    discountPercent: number,
  ): { name: string; amount: number }[] {
    let statusAmount = 0;
    let bonusCount = 0;
    const promoAmountByType = new Map<PromotionType, number>();

    items.forEach((item, index) => {
      const product = productById.get(item.productId)!;
      const promo = promoByIndex.get(index);
      const freeUnits = Math.min(promo?.freeUnits ?? 0, item.quantity);
      const paidQuantity = item.quantity - freeUnits;

      bonusCount += freeUnits;

      const promoPercent = promo?.discountPercent ?? 0;
      const appliedPercent = Math.max(discountPercent, promoPercent);
      if (appliedPercent === 0 || paidQuantity === 0) return;

      const paidLineTotal = product.price * paidQuantity;
      const percentAmount = paidLineTotal - applyDiscount(paidLineTotal, appliedPercent);

      if (promoPercent > discountPercent && promo?.discountPercentType) {
        const type = promo.discountPercentType;
        promoAmountByType.set(type, (promoAmountByType.get(type) ?? 0) + percentAmount);
      } else {
        statusAmount += percentAmount;
      }
    });

    const discounts: { name: string; amount: number }[] = [];
    if (statusAmount > 0) {
      discounts.push({ name: 'Referal dasturi chegirmasi', amount: statusAmount });
    }
    for (const [type, amount] of promoAmountByType) {
      if (amount > 0) discounts.push({ name: this.promotionService.getDisplayName(type), amount });
    }
    if (bonusCount > 0) {
      discounts.push({ name: 'Bonus mahsulotlar', amount: bonusCount });
    }

    return discounts;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchPendingDeliveries(): Promise<void> {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);

    // Clear payload for orders that missed the acceptance window
    await this.orderRepo
      .createQueryBuilder()
      .update()
      .set({ deliveryPayload: () => 'NULL' })
      .where(
        'type = :type AND status = :status AND delivery_payload IS NOT NULL AND created_at < :cutoff',
        { type: OrderType.DELIVERY, status: OrderStatus.CREATED, cutoff },
      )
      .execute();

    const pending = await this.orderRepo.find({
      where: {
        type: OrderType.DELIVERY,
        status: OrderStatus.CREATED,
        deliveryPayload: Not(IsNull()),
        createdAt: MoreThan(cutoff),
      },
      relations: ['user'],
    });

    if (!pending.length) return;

    const dateFrom = new Date(Date.now() - 15 * 60 * 1000);
    const acceptedIds = await this.posterService.getTransactions(dateFrom);
    const accepted = new Set(acceptedIds);

    for (const order of pending) {
      if (order.posId === null || !accepted.has(order.posId)) continue;

      const session = await this.sessionRepo.findOne({ where: { user: { id: order.user.id } } });
      if (session?.fcmToken) {
        await this.pushService.send(session.fcmToken, 'Fruits Time', 'Buyurtmangiz qabul qilindi');
      }

      const ok = await this.deliveryService.createOrder(order.deliveryPayload!);
      if (ok) {
        await this.orderRepo.update(order.id, { deliveryPayload: null });
        this.logger.log(`dispatchPendingDeliveries: dispatched delivery for order ${order.id}`);
      } else {
        this.logger.error(`dispatchPendingDeliveries: delivery dispatch failed for order ${order.id}`);
      }
    }
  }

  private async sendToPoster(
    userId: string,
    products: Product[],
    items: OrderItemInput[],
    type: OrderType,
    spotId: number,
    getItemUnitPrice: (index: number, unitPrice: number, quantity: number) => number,
    deliveryCost?: number,
  ): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.posId) {
      this.logger.error(`POS order rejected: user ${userId} has no posId`);
      throw new InternalServerErrorException('POS klienti sozlanmagan');
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const posterProducts: { id: number; count: number; price?: number }[] = [];

    for (const [index, item] of items.entries()) {
      const product = productById.get(item.productId);
      if (!product?.posId) {
        this.logger.error(`POS order rejected: product ${item.productId} has no posId`);
        throw new InternalServerErrorException("Mahsulot POS bilan bog'lanmagan");
      }
      posterProducts.push({
        id: product.posId,
        count: item.quantity,
        price: getItemUnitPrice(index, product.price, item.quantity),
      });
    }

    const posOrderId = await this.posterService.createOrder({
      spotId,
      autoAccept: false,
      serviceMode: type === OrderType.DELIVERY ? 3 : 2,
      client: { id: user.posId },
      products: posterProducts,
      ...(type === OrderType.DELIVERY
        ? { delivery: { ...POSTER_DELIVERY_BASE, deliveryPrice: deliveryCost ?? 15_000 } }
        : {}),
    });

    if (posOrderId === null) {
      throw new InternalServerErrorException("POSga buyurtma yuborib bo'lmadi");
    }
    return posOrderId;
  }

  async getActiveForUser(userId: string, locale: Locale) {
    const order = await this.orderRepo.findOne({
      where: { user: { id: userId }, status: OrderStatus.CREATED },
      relations: ['items', 'items.product'],
    });
    return order ? this.mapOrder(order, locale) : null;
  }

  async listForUser(userId: string, locale: Locale) {
    const orders = await this.orderRepo.find({
      where: { user: { id: userId } },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => this.mapOrder(order, locale));
  }

  async listForAdmin(page: number, pageSize: number, locale: Locale) {
    const [orders, total] = await this.orderRepo.findAndCount({
      relations: ['items', 'items.product', 'user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      data: orders.map((order) => ({
        ...this.mapOrder(order, locale),
        user: {
          id: order.user.id,
          firstName: order.user.firstName,
          phoneNumber: order.user.phoneNumber,
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  handleDeliveryWebhook(body: unknown): void {
    this.logger.log(`handle-order webhook: ${JSON.stringify(body)}`);
    this.processDeliveryWebhook(body as DeliveryWebhookBody).catch((err: unknown) => {
      this.logger.error(`processDeliveryWebhook failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  private async processDeliveryWebhook(body: DeliveryWebhookBody): Promise<void> {
    const order = await this.orderRepo.findOne({
      where: { id: body.vendor_order_id },
      relations: ['user'],
    });

    if (!order) {
      this.logger.warn(`Webhook: order ${body.vendor_order_id} not found`);
      return;
    }

    const updates: Partial<Order> = {};

    const newStatus = stageToOrderStatus(body.stage);
    if (newStatus !== null) updates.status = newStatus;

    const link = body.order?.link ?? null;
    if (link !== null) updates.link = link;

    if (Object.keys(updates).length) {
      await this.orderRepo.update(order.id, updates);
    }

    const session = await this.sessionRepo.findOne({ where: { user: { id: order.user.id } } });
    if (session?.fcmToken) {
      const message = DELIVERY_STAGE_MESSAGE[body.stage];
      if (message) {
        await this.pushService.send(session.fcmToken, 'Fruits Time', message);
      }
    }
  }

  private mapOrder(order: Order, locale: Locale) {
    return {
      id: order.id,
      posId: order.posId,
      status: order.status,
      type: order.type,
      address: order.address,
      link: order.link,
      deliveryCost: order.deliveryCost,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        actualPrice: item.actualPrice,
        product: {
          ...item.product,
          title: item.product.getTitle(locale),
          description: item.product.getDescription(locale),
          compound: item.product.getCompound(locale),
        },
      })),
    };
  }
}
