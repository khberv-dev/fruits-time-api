import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@/shared/entities/user.entity';
import { OrderItem } from '@/shared/entities/order-item.entity';
import { OrderStatus } from '@/shared/enums/order-status.enum';
import { OrderType } from '@/shared/enums/order-type.enum';
import { Coordinates } from '@/shared/types/coordinates.type';
import { DeliveryCreateOrderInput } from '@/core/delivery/types/delivery-create-order-input.type';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.CREATED })
  status: OrderStatus;

  @Column({ type: 'enum', enum: OrderType, default: OrderType.PICKUP })
  type: OrderType;

  @Column({ type: 'jsonb', nullable: true })
  address: Coordinates | null;

  @Column({ name: 'pos_id', type: 'int', nullable: true })
  posId: number | null;

  @Column({ name: 'delivery_cost', type: 'int', nullable: true, default: null })
  deliveryCost: number | null;

  @Column({ name: 'delivery_payload', type: 'jsonb', nullable: true, default: null })
  deliveryPayload: DeliveryCreateOrderInput | null;

  @Column({ type: 'text', nullable: true, default: null })
  link: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
