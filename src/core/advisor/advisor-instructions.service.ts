import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '@/shared/entities/order.entity';
import { OrderItem } from '@/shared/entities/order-item.entity';
import { Product } from '@/shared/entities/product.entity';
import { Branch } from '@/shared/entities/branch.entity';
import { User } from '@/shared/entities/user.entity';
import { Catalog } from '@/shared/entities/catalog.entity';
import { UserRole } from '@/shared/enums/user-role.enum';
import { OrderStatus } from '@/shared/enums/order-status.enum';
import { getObjectDefaultValue } from '@/shared/utils/lib';

@Injectable()
export class AdvisorInstructionsService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Catalog) private readonly catalogRepo: Repository<Catalog>,
  ) {}

  async buildSnapshot(): Promise<string> {
    const [summary, ordersByStatus, ordersByType, revenue, topProducts, recentOrders, branches, products] =
      await Promise.all([
        this.getSummary(),
        this.getOrdersByStatus(),
        this.getOrdersByType(),
        this.getRevenue(),
        this.getTopProducts(),
        this.getRecentOrders(),
        this.getBranches(),
        this.getProducts(),
      ]);

    const lines = [
      `You are Fruits Time's AI business advisor. Today is ${new Date().toISOString()}.`,
      'Fruits Time is a company that sells healthy and natural juices and vitamins.',
      'You answer business questions based on the real-time data snapshot provided below.',
      'Only answer questions relevant to the business: sales, orders, users, products, branches, revenue, trends.',
      'Do not answer off-topic questions.',
      'Keep answers concise and data-driven. Never expose internal IDs in your answer.',
      '',
      '=== BUSINESS SNAPSHOT ===',
      '',
      `SUMMARY:`,
      `  Total customers: ${summary.usersCount}`,
      `  Total orders: ${summary.ordersCount}`,
      `  Total products: ${summary.productsCount}`,
      `  Total catalogs: ${summary.catalogsCount}`,
      `  Total branches: ${summary.branchesCount}`,
      '',
      `ORDERS BY STATUS:`,
      ...ordersByStatus.map((r) => `  ${r.status}: ${r.count}`),
      '',
      `ORDERS BY TYPE:`,
      ...ordersByType.map((r) => `  ${r.type}: ${r.count}`),
      '',
      `REVENUE (completed orders): ${revenue} sum`,
      '',
      `TOP 10 PRODUCTS BY ORDER COUNT:`,
      ...topProducts.map((p, i) => `  ${i + 1}. ${p.title} — ordered ${p.orderCount}x, qty sold: ${p.totalQty}`),
      '',
      `BRANCHES (${branches.length}):`,
      ...branches.map(
        (b) =>
          `  - ${b.name} | ${b.address} | working: ${b.isWorking} | active: ${b.isActive}${b.managerName ? ` | manager: ${b.managerName} (${b.managerPhone})` : ''}`,
      ),
      '',
      `PRODUCTS (${products.length}):`,
      ...products.map(
        (p) => `  - [${p.catalog}] ${p.title} | price: ${p.price} sum | active: ${p.isActive}`,
      ),
      '',
      `RECENT 30 ORDERS (newest first):`,
      ...recentOrders.map(
        (o) =>
          `  - ${o.createdAt.toISOString().slice(0, 16)} | ${o.status} | ${o.type} | customer: ${o.customerName} | items: ${o.itemCount} | total: ${o.total} sum`,
      ),
    ];

    return lines.join('\n');
  }

  private async getSummary() {
    const [usersCount, ordersCount, productsCount, catalogsCount, branchesCount] = await Promise.all([
      this.userRepo.count({ where: { role: UserRole.USER } }),
      this.orderRepo.count(),
      this.productRepo.count(),
      this.catalogRepo.count(),
      this.branchRepo.count(),
    ]);
    return { usersCount, ordersCount, productsCount, catalogsCount, branchesCount };
  }

  private getOrdersByStatus(): Promise<{ status: string; count: string }[]> {
    return this.orderRepo.query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status ORDER BY count DESC`);
  }

  private getOrdersByType(): Promise<{ type: string; count: string }[]> {
    return this.orderRepo.query(`SELECT type, COUNT(*)::int AS count FROM orders GROUP BY type ORDER BY count DESC`);
  }

  private async getRevenue(): Promise<number> {
    const result: { total: string }[] = await this.orderItemRepo.query(
      `SELECT COALESCE(SUM(oi.actual_price * oi.quantity), 0)::bigint AS total
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status = $1`,
      [OrderStatus.DONE],
    );
    return Number(result[0]?.total ?? 0);
  }

  private async getTopProducts(): Promise<{ title: string; orderCount: number; totalQty: number }[]> {
    const rows: { title: Record<string, string>; order_count: string; total_qty: string }[] =
      await this.orderItemRepo.query(
        `SELECT p.title, COUNT(oi.id)::int AS order_count, SUM(oi.quantity)::int AS total_qty
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         GROUP BY p.id, p.title
         ORDER BY order_count DESC
         LIMIT 10`,
      );
    return rows.map((r) => ({
      title: getObjectDefaultValue(r.title, ''),
      orderCount: Number(r.order_count),
      totalQty: Number(r.total_qty),
    }));
  }

  private async getRecentOrders(): Promise<
    { createdAt: Date; status: string; type: string; customerName: string; itemCount: number; total: number }[]
  > {
    const rows: {
      created_at: string;
      status: string;
      type: string;
      first_name: string;
      item_count: string;
      total: string;
    }[] = await this.orderRepo.query(
      `SELECT o.created_at, o.status, o.type, u.first_name,
              COUNT(oi.id)::int AS item_count,
              COALESCE(SUM(oi.actual_price * oi.quantity), 0)::int AS total
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id, o.created_at, o.status, o.type, u.first_name
       ORDER BY o.created_at DESC
       LIMIT 30`,
    );
    return rows.map((r) => ({
      createdAt: new Date(r.created_at),
      status: r.status,
      type: r.type,
      customerName: r.first_name,
      itemCount: Number(r.item_count),
      total: Number(r.total),
    }));
  }

  private async getBranches() {
    return this.branchRepo.find({ order: { name: 'ASC' } });
  }

  private async getProducts(): Promise<{ catalog: string; title: string; price: number; isActive: boolean }[]> {
    const products = await this.productRepo.find({ relations: ['catalog'], order: { index: 'ASC' } });
    return products.map((p) => ({
      catalog: getObjectDefaultValue(p.catalog?.title ?? {}, ''),
      title: getObjectDefaultValue(p.title, ''),
      price: p.price,
      isActive: p.isActive,
    }));
  }
}
