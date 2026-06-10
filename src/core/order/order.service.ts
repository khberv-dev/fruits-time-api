import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, LessThan, Repository } from 'typeorm';
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
  if (stage >= 19 && stage <= 29) return OrderStatus.CANCELLED;
  return null;
}

function applyDiscount(price: number, discountPercent: number): number {
  return Math.round(price * (1 - discountPercent / 100));
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
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelStaleOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
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

    const clientPhone = user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber}`;
    const cost = await this.deliveryService.evalOrder({
      vendorOrderId: 'eval',
      items: [],
      origin: { location: { long: branch.long, lat: branch.lat }, address: branch.address, client: { phone: clientPhone, name: user.firstName } },
      destination: { location: { long: address.long, lat: address.lat }, address: address.name, client: { phone: clientPhone, name: user.firstName } },
    });

    if (cost === null) throw new InternalServerErrorException("Yetkazib berish narxini hisoblashda xatolik");
    return { cost };
  }

  async create(userId: string, locale: Locale, data: CreateOrderRequest) {
    const activeOrder = await this.orderRepo.findOne({ where: { user: { id: userId }, status: OrderStatus.CREATED } });
    if (activeOrder) throw new BadRequestException('Sizda allaqachon faol buyurtma mavjud');

    const productIds = [...new Set(data.items.map((item) => item.productId))];

    const products = await this.productRepo.find({ where: { id: In(productIds), isActive: true } });
    const branch = await this.branchRepo.findOne({ where: { id: data.branchId, isActive: true } });

    if (products.length !== productIds.length) {
      throw new BadRequestException("Mahsulot topilmadi yoki sotuvda yo'q");
    }

    if (!branch) {
      throw new BadRequestException('Filial topilmadi yoki faol emas');
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

    const productById = new Map(products.map((product) => [product.id, product]));

    let deliveryInput: DeliveryCreateOrderInput | null = null;
    let deliveryCost: number | undefined;

    if (data.type === OrderType.DELIVERY && savedAddress) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) throw new InternalServerErrorException('Foydalanuvchi topilmadi');
      if (branch.long === null || branch.lat === null) throw new InternalServerErrorException('Filial koordinatalari sozlanmagan');
      if (!branch.address) throw new InternalServerErrorException('Filial manzili sozlanmagan');

      const clientPhone = user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber}`;
      const client = { phone: clientPhone, name: user.firstName };

      deliveryInput = {
        vendorOrderId: '',
        items: data.items.map((item) => {
          const product = productById.get(item.productId)!;
          return {
            name: product.getTitle(locale),
            price_per_unit: applyDiscount(product.price, discountPercent),
            quantity: item.quantity,
            width: 10, height: 10, length: 10, weight: 10,
          };
        }),
        origin: { location: { long: branch.long, lat: branch.lat }, address: branch.address, client },
        destination: { location: { long: savedAddress.long, lat: savedAddress.lat }, address: savedAddress.name, client },
      };

      const evaluated = await this.deliveryService.evalOrder({ ...deliveryInput, vendorOrderId: 'eval' });
      deliveryCost = evaluated ?? undefined;
    }

    // Save the order, call POS, and (if delivery) call the delivery service in
    // a single transaction so any external failure rolls back the DB row.
    const order = await this.orderRepo.manager.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);

      const inserted = await orderRepo.save({
        user: { id: userId } as User,
        type: data.type,
        address: addressSnapshot,
        items: data.items.map((item) => {
          const lineTotal = productById.get(item.productId)!.price * item.quantity;
          return {
            product: { id: item.productId } as Product,
            quantity: item.quantity,
            price: applyDiscount(lineTotal, discountPercent),
            actualPrice: lineTotal,
          };
        }),
      });

      const order = await orderRepo.findOneOrFail({
        where: { id: inserted.id },
        relations: ['items', 'items.product'],
      });

      order.posId = await this.sendToPoster(userId, products, data, branch.posId, discountPercent, deliveryCost);
      await orderRepo.save(order);

      if (data.type === OrderType.DELIVERY && deliveryInput) {
        await this.sendToDelivery(order, deliveryInput);
      }

      return order;
    });

    return this.mapOrder(order, locale);
  }

  private async sendToDelivery(order: Order, input: DeliveryCreateOrderInput): Promise<void> {
    const ok = await this.deliveryService.createOrder({ ...input, vendorOrderId: order.id });
    if (!ok) {
      throw new InternalServerErrorException("Yetkazib berish xizmatiga buyurtma yuborib bo'lmadi");
    }
  }

  private async sendToPoster(
    userId: string,
    products: Product[],
    data: CreateOrderRequest,
    spotId: number,
    discountPercent: number,
    deliveryCost?: number,
  ): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.posId) {
      this.logger.error(`POS order rejected: user ${userId} has no posId`);
      throw new InternalServerErrorException('POS klienti sozlanmagan');
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const posterProducts: { id: number; count: number; price?: number }[] = [];

    for (const item of data.items) {
      const product = productById.get(item.productId);
      if (!product?.posId) {
        this.logger.error(`POS order rejected: product ${item.productId} has no posId`);
        throw new InternalServerErrorException("Mahsulot POS bilan bog'lanmagan");
      }
      posterProducts.push({
        id: product.posId,
        count: item.quantity,
        price: applyDiscount(product.price, discountPercent),
      });
    }

    const posOrderId = await this.posterService.createOrder({
      spotId,
      autoAccept: false,
      serviceMode: data.type === OrderType.DELIVERY ? 3 : 2,
      client: { id: user.posId },
      products: posterProducts,
      ...(data.type === OrderType.DELIVERY
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
