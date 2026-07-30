import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Localized } from '@/shared/types/localized.type';
import { Locale } from '@/shared/enums/locale.enum';
import { getObjectDefaultValue } from '@/shared/utils/lib';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', default: {} })
  title: Localized<string>;

  // Products a subscriber can take for free each day. Stored as ids rather than a join
  // table, following the same pattern as Promotion.productIds.
  @Column({ name: 'product_ids', type: 'jsonb', nullable: true, default: null })
  productIds: string[] | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  getTitle(locale: Locale): string {
    return this.title[locale] ?? getObjectDefaultValue(this.title, '');
  }
}
