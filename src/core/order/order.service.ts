import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '@/shared/entities/order.entity';
import { Product } from '@/shared/entities/product.entity';
import { User } from '@/shared/entities/user.entity';
import { Locale } from '@/shared/enums/locale.enum';
import { CreateOrderRequest } from '@/core/order/dto/create-order-request.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async create(userId: string, locale: Locale, data: CreateOrderRequest) {
    const productIds = [...new Set(data.items.map((item) => item.productId))];

    const activeCount = await this.productRepo.count({
      where: { id: In(productIds), isActive: true },
    });

    if (activeCount !== productIds.length) {
      throw new BadRequestException("Mahsulot topilmadi yoki sotuvda yo'q");
    }

    const saved = await this.orderRepo.save({
      user: { id: userId } as User,
      items: data.items.map((item) => ({
        product: { id: item.productId } as Product,
        quantity: item.quantity,
      })),
    });

    const order = await this.orderRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['items', 'items.product'],
    });

    return this.mapOrder(order, locale);
  }

  async listForUser(userId: string, locale: Locale, page: number, pageSize: number) {
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { user: { id: userId } },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      orders: orders.map((order) => this.mapOrder(order, locale)),
      total,
      pages: Math.ceil(total / pageSize),
    };
  }

  private mapOrder(order: Order, locale: Locale) {
    return {
      id: order.id,
      orderId: order.orderId,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
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
