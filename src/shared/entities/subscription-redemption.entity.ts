import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '@/shared/entities/user.entity';
import { Order } from '@/shared/entities/order.entity';

// How much of the daily subscription allowance an order consumed, written inside the order
// transaction. OrderItem alone can't back the allowance because it doesn't record which
// discount produced a given price. Rows stay put when an order is cancelled; the allowance
// query skips cancelled orders instead, which hands the money back.
@Entity('subscription_redemptions')
@Index(['user', 'createdAt'])
export class SubscriptionRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  // Sum discounted, pooled across every covered line in the order.
  @Column({ type: 'int' })
  amount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
