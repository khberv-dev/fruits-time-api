import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Localized } from '@/shared/types/localized.type';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', default: Localized.defaultString })
  image: Localized<string>;

  @Column({ type: 'jsonb', default: Localized.defaultString })
  title: Localized<string>;

  @Column({ type: 'jsonb', default: Localized.defaultString })
  content: Localized<string>;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
