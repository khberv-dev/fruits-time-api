import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { Catalog } from '@/shared/entities/catalog.entity';
import { Product } from '@/shared/entities/product.entity';
import { UserRole } from '@/shared/enums/user-role.enum';
import { Order } from '@/shared/entities/order.entity';
import { SubscriptionCode } from '@/shared/entities/subscription-code.entity';
import { Locale } from '@/shared/enums/locale.enum';

const RECENT_LIMIT = 10;

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Catalog) private readonly catalogRepo: Repository<Catalog>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(SubscriptionCode) private readonly codeRepo: Repository<SubscriptionCode>,
  ) {}

  // Dashboard "latest activity": the 10 newest end-users, orders, and subscription
  // activations. Subscriptions are counted from redeemed codes — a redeemed code is the
  // user↔subscription link — and only while the subscription itself is still switched on.
  async getRecent(locale: Locale) {
    const [users, orders, activations] = await Promise.all([
      this.userRepo.find({
        where: { role: UserRole.USER },
        order: { createdAt: 'DESC' },
        take: RECENT_LIMIT,
      }),
      this.orderRepo.find({
        relations: ['user', 'items', 'branch'],
        order: { createdAt: 'DESC' },
        take: RECENT_LIMIT,
      }),
      this.codeRepo.find({
        where: { redeemedAt: Not(IsNull()), subscription: { isActive: true } },
        relations: ['user', 'subscription'],
        order: { redeemedAt: 'DESC' },
        take: RECENT_LIMIT,
      }),
    ]);

    return {
      users: users.map((user) => this.mapUser(user)),
      orders: orders.map((order) => ({
        id: order.id,
        posId: order.posId,
        status: order.status,
        type: order.type,
        // items.price is the discounted line total, so summing gives what was charged
        // for the products; delivery is billed separately.
        total: order.items.reduce((sum, item) => sum + item.price, 0),
        deliveryCost: order.deliveryCost,
        branch: order.branch ? { id: order.branch.id, name: order.branch.name } : null,
        user: this.mapUser(order.user),
        createdAt: order.createdAt,
      })),
      subscriptions: activations.map((entry) => ({
        codeId: entry.id,
        code: entry.code,
        redeemedAt: entry.redeemedAt,
        user: entry.user ? this.mapUser(entry.user) : null,
        subscription: {
          id: entry.subscription.id,
          title: entry.subscription.getTitle(locale),
          discountAmount: entry.subscription.discountAmount,
        },
      })),
    };
  }

  private mapUser(user: User) {
    return { id: user.id, firstName: user.firstName, phoneNumber: user.phoneNumber, createdAt: user.createdAt };
  }

  async getSummary() {
    const usersCount = await this.userRepo.count({
      where: {
        role: UserRole.USER,
      },
    });

    const catalogsCount = await this.catalogRepo.count();
    const productsCount = await this.productRepo.count();
    const ordersCount = await this.orderRepo.count();

    return {
      usersCount,
      catalogsCount,
      productsCount,
      ordersCount,
    };
  }

  getUsersTrend(startDate: Date, endDate: Date) {
    return this.userRepo.query(
      `
        SELECT d.date::date AS date,
      COALESCE(COUNT(u.id), 0)::int AS count
        FROM generate_series(
          $1:: date, $2:: date, interval '1 day'
          ) AS d(date)
          LEFT JOIN users u
        ON u.created_at >= d.date
          AND u.created_at < d.date + interval '1 day' AND u.role = 'user'
        GROUP BY d.date
        ORDER BY d.date ASC
      `,
      [startDate, endDate],
    );
  }

  getOrdersTrend(startDate: Date, endDate: Date) {
    return this.orderRepo.query(
      `
        SELECT d.date::date AS date,
      COALESCE(COUNT(o.id), 0)::int AS count
        FROM generate_series(
          $1:: date, $2:: date, interval '1 day'
          ) AS d(date)
          LEFT JOIN orders o
        ON o.created_at >= d.date
          AND o.created_at < d.date + interval '1 day'
        GROUP BY d.date
        ORDER BY d.date ASC
      `,
      [startDate, endDate],
    );
  }
}
