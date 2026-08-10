import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@/shared/entities/user.entity';
import { SubscriptionRequestStatus } from '@/shared/enums/subscription-request-status.enum';

// A customer asking to be signed up. Purely a call list for admins — accepting one grants
// nothing, it only records that somebody has been contacted. Handing out the actual
// entitlement is still a separate manual step: generate a code and give it to them.
@Entity('subscription_requests')
@Index(['status', 'createdAt'])
export class SubscriptionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: SubscriptionRequestStatus, default: SubscriptionRequestStatus.NEW })
  status: SubscriptionRequestStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
