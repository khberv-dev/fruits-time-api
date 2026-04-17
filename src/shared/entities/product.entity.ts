import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Localized } from '@/shared/types/localized.type';
import { Catalog } from '@/shared/entities/catalog.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  image: string;

  @Column({ type: 'jsonb', default: Localized.defaultString })
  title: Localized<string>;

  @Column({ type: 'jsonb', default: Localized.defaultString })
  description: Localized<string>;

  @Column({ type: 'jsonb', default: Localized.defaultString })
  compound: Localized<string[]>;

  @Column({ default: 0 })
  price: number;

  @ManyToOne(() => Catalog, (catalog) => catalog.products)
  @JoinColumn({ name: 'catalog_id' })
  catalog: Catalog;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
