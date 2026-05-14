import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '@/shared/entities/order.entity';
import { Product } from '@/shared/entities/product.entity';
import { User } from '@/shared/entities/user.entity';
import { Branch } from '@/shared/entities/branch.entity';
import { Locale } from '@/shared/enums/locale.enum';
import { CreateOrderRequest } from '@/core/order/dto/create-order-request.dto';
import { PosterService } from '@/core/poster/poster.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger('Order Service');

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    private readonly posterService: PosterService,
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

    const posOrderId = await this.sendToPoster(userId, products, data, branch.posId);
    if (posOrderId !== null) {
      order.posId = posOrderId;
      await this.orderRepo.save(order);
    }

    return this.mapOrder(order, locale);
  }

  private async sendToPoster(
    userId: string,
    products: Product[],
    data: CreateOrderRequest,
    spotId: number,
  ): Promise<number | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.posId) {
      this.logger.warn(`Skipping POS order: user ${userId} has no posId`);
      return null;
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const posterProducts: { id: number; count: number }[] = [];

    for (const item of data.items) {
      const product = productById.get(item.productId);
      if (!product?.posId) {
        this.logger.warn(`Skipping POS order: product ${item.productId} has no posId`);
        return null;
      }
      posterProducts.push({ id: product.posId, count: item.quantity });
    }

    return this.posterService.createOrder({
      spotId,
      autoAccept: false,
      client: { id: user.posId },
      products: posterProducts,
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
