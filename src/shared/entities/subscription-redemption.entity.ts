import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '@/shared/entities/user.entity';
import { Product } from '@/shared/entities/product.entity';
import { Order } from '@/shared/entities/order.entity';

// One row per free unit granted by a subscription, written inside the order transaction.
// OrderItem alone can't back the daily quota because it doesn't record *why* a unit was
// free (subscription vs. loyalty vs. 2+1). Rows stay put when an order is cancelled; the
// quota query skips cancelled orders instead, which hands the allowance back.
@Entity('subscription_redemptions')
@Index(['user', 'createdAt'])
export class SubscriptionRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'int' })
  quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
