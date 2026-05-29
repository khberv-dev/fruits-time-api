import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import { computeUserStatus, getStatusDiscount } from '@/core/user/user.service';

function applyDiscount(price: number, discountPercent: number): number {
  return Math.round(price * (1 - discountPercent / 100));
}

const POSTER_DELIVERY = { courierId: 0, deliveryPrice: 15000, processingStatus: 0 };

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

    const addressSnapshot: Coordinates | null = savedAddress
      ? { long: savedAddress.long, lat: savedAddress.lat }
      : null;

    const referralCount = await this.userRepo.count({ where: { referredBy: { id: userId } } });
    const discountPercent = getStatusDiscount(computeUserStatus(referralCount));

    const productById = new Map(products.map((product) => [product.id, product]));

    const saved = await this.orderRepo.save({
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

    const order = await this.orderRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['items', 'items.product'],
    });

    const posOrderId = await this.sendToPoster(userId, products, data, branch.posId, discountPercent);
    if (posOrderId !== null) {
      order.posId = posOrderId;
      await this.orderRepo.save(order);
    }

    if (data.type === OrderType.DELIVERY) {
      await this.sendToDelivery(order, branch, savedAddress, userId);
    }

    return this.mapOrder(order, locale);
  }

  private async sendToDelivery(order: Order, branch: Branch, address: Address | null, userId: string): Promise<void> {
    if (!address) {
      this.logger.warn(`Skipping delivery: order ${order.id} has no addressId`);
      return;
    }

    if (branch.long === null || branch.lat === null) {
      this.logger.warn(`Skipping delivery: branch ${branch.id} has no coordinates`);
      return;
    }

    if (!branch.address) {
      this.logger.warn(`Skipping delivery: branch ${branch.id} has no address`);
      return;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`Skipping delivery: user ${userId} not found`);
      return;
    }

    await this.deliveryService.createOrder({
      vendorOrderId: order.id,
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
      },
    });
  }

  private async sendToPoster(
    userId: string,
    products: Product[],
    data: CreateOrderRequest,
    spotId: number,
    discountPercent: number,
  ): Promise<number | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.posId) {
      this.logger.warn(`Skipping POS order: user ${userId} has no posId`);
      return null;
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const posterProducts: { id: number; count: number; price?: number }[] = [];

    for (const item of data.items) {
      const product = productById.get(item.productId);
      if (!product?.posId) {
        this.logger.warn(`Skipping POS order: product ${item.productId} has no posId`);
        return null;
      }
      posterProducts.push({
        id: product.posId,
        count: item.quantity,
        price: applyDiscount(product.price, discountPercent),
      });
    }

    return this.posterService.createOrder({
      spotId,
      autoAccept: false,
      serviceMode: data.type === OrderType.DELIVERY ? 3 : 2,
      client: { id: user.posId },
      products: posterProducts,
      ...(data.type === OrderType.DELIVERY ? { delivery: POSTER_DELIVERY } : {}),
    });
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
