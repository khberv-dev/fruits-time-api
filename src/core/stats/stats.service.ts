import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { Catalog } from '@/shared/entities/catalog.entity';
import { Product } from '@/shared/entities/product.entity';
import { UserRole } from '@/shared/enums/user-role.enum';
import { Order } from '@/shared/entities/order.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Catalog) private readonly catalogRepo: Repository<Catalog>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
  ) {}

  async getSummary() {
    const userCount = await this.userRepo.count({
      where: {
        role: UserRole.USER,
      },
    });

    const catalogCount = await this.catalogRepo.count();
    const productCount = await this.productRepo.count();

    return {
      userCount,
      catalogCount,
      productCount,
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
