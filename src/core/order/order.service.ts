import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, LessThan, Repository } from 'typeorm';
import { Order } from '@/shared/entities/order.entity';
import { Product } from '@/shared/entities/product.entity';
import { User } from '@/shared/entities/user.entity';
import { Branch } from '@/shared/entities/branch.entity';
import { Address } from '@/shared/entities/address.entity';
import { Coordinates } from '@/shared/types/coordinates.type';
import { Locale } from '@/shared/enums/locale.enum';
import { CreateOrderRequest } from '@/core/order/dto/create-order-request.dto';
import { PosterService } from '@/core/poster/poster.service';
import { DeliveryService } from '@/core/delivery/delivery.service';
import { OrderType } from '@/shared/enums/order-type.enum';
import { OrderStatus } from '@/shared/enums/order-status.enum';
import { computeUserStatus, getStatusDiscount } from '@/core/user/user.service';
import { calculateDeliveryCost } from '@/shared/utils/lib';

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
    private readonly posterService: PosterService,
    private readonly deliveryService: DeliveryService,
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
    const branch = await this.branchRepo.findOne({ where: { id: branchId, isActive: true } });
    if (!branch) throw new BadRequestException('Filial topilmadi yoki faol emas');
    if (branch.lat === null || branch.long === null) throw new BadRequestException('Filial koordinatalari sozlanmagan');

    const address = await this.addressRepo.findOne({ where: { id: addressId, user: { id: userId } } });
    if (!address) throw new BadRequestException('Manzil topilmadi');

    return { cost: calculateDeliveryCost(branch.lat, branch.long, address.lat, address.long) };
  }

  async create(userId: string, locale: Locale, data: CreateOrderRequest) {
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

      const deliveryCost =
        data.type === OrderType.DELIVERY && branch.lat !== null && branch.long !== null && savedAddress
          ? calculateDeliveryCost(branch.lat, branch.long, savedAddress.lat, savedAddress.long)
          : undefined;

      order.posId = await this.sendToPoster(userId, products, data, branch.posId, discountPercent, deliveryCost);
      await orderRepo.save(order);

      if (data.type === OrderType.DELIVERY) {
        await this.sendToDelivery(order, branch, savedAddress, userId, locale);
      }

      return order;
    });

    return this.mapOrder(order, locale);
  }

  private async sendToDelivery(
    order: Order,
    branch: Branch,
    address: Address | null,
    userId: string,
    locale: Locale,
  ): Promise<void> {
    if (!address) {
      // Pre-validated in create(); defensive.
      throw new BadRequestException("Yetkazib berish uchun manzil ko'rsatilishi shart");
    }

    if (branch.long === null || branch.lat === null) {
      this.logger.error(`Delivery rejected: branch ${branch.id} has no coordinates`);
      throw new InternalServerErrorException('Filial koordinatalari sozlanmagan');
    }

    if (!branch.address) {
      this.logger.error(`Delivery rejected: branch ${branch.id} has no address`);
      throw new InternalServerErrorException('Filial manzili sozlanmagan');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new InternalServerErrorException('Foydalanuvchi topilmadi');
    }

    const ok = await this.deliveryService.createOrder({
      vendorOrderId: order.id,
      items: order.items.map((item) => ({
        name: item.product.getTitle(locale),
        price_per_unit: Math.round(item.price / item.quantity),
        quantity: item.quantity,
        width: 10,
        height: 10,
        length: 10,
        weight: 10,
      })),
      origin: {
        location: { long: branch.long, lat: branch.lat },
        address: branch.address,
        client: {
          phone: user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber}`,
          name: user.firstName,
        },
      },
      destination: {
        location: { long: address.long, lat: address.lat },
        address: address.name,
        client: {
          phone: user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber}`,
          name: user.firstName,
        },
      },
    });

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

  async listForUser(userId: string, locale: Locale) {
    const orders = await this.orderRepo.find({
      where: { user: { id: userId } },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => this.mapOrder(order, locale));
  }

  private mapOrder(order: Order, locale: Locale) {
    return {
      id: order.id,
      posId: order.posId,
      status: order.status,
      type: order.type,
      address: order.address,
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
