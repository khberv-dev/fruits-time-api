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

  // Products the daily discount can be spent against. Stored as ids rather than a join
  // table, following the same pattern as Promotion.productIds.
  @Column({ name: 'product_ids', type: 'jsonb', nullable: true, default: null })
  productIds: string[] | null;

  // A fixed sum the holder may knock off the covered products each day. Anything the
  // covered lines cost beyond this is paid normally, and the amount never spills over
  // onto products outside the list.
  @Column({ name: 'discount_amount', type: 'int', default: 0 })
  discountAmount: number;

  // How long the entitlement lasts from the moment a code is redeemed. Null means it never
  // expires, which is what every subscription created before this column did, so existing
  // holders keep theirs indefinitely.
  @Column({ name: 'duration_days', type: 'int', nullable: true, default: null })
  durationDays: number | null;

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
