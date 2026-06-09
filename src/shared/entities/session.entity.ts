import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '@/shared/entities/user.entity';
import { Os } from '@/shared/enums/os.enum';
import { Locale } from '@/shared/enums/locale.enum';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'fcm_token' })
  fcmToken: string;

  @Column({ type: 'enum', enum: Os })
  os: Os;

  @Column({ type: 'enum', enum: Locale, default: Locale.uz })
  locale: Locale;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
