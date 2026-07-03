import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PromotionType } from '@/shared/enums/promotion-type.enum';

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PromotionType, unique: true })
  type: PromotionType;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Only used by promotions scoped to specific products (e.g. buy-two-get-one-free).
  @Column({ name: 'product_ids', type: 'jsonb', nullable: true, default: null })
  productIds: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
