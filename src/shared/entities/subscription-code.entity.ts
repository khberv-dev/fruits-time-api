import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Subscription } from '@/shared/entities/subscription.entity';
import { User } from '@/shared/entities/user.entity';

// A redeemed code *is* the user↔subscription link — there's no separate assignment table.
// Admins generate codes, hand them out, and whoever redeems one gets the entitlement.
@Entity('subscription_codes')
@Index(['user'])
export class SubscriptionCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  code: string;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  // Null until redeemed; single-use, so this doubles as the "already claimed" marker.
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'redeemed_at', type: 'timestamptz', nullable: true, default: null })
  redeemedAt: Date | null;

  // Snapshotted at redemption from the subscription's durationDays, rather than derived on
  // read, so later edits to that setting only affect codes redeemed afterwards and can't
  // retroactively shorten — or instantly lapse — an entitlement someone already holds.
  // Null means it never expires, which is also what codes redeemed before this column get.
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true, default: null })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
