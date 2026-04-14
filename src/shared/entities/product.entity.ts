import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Localized } from '@/shared/types/localized.type';
import { Catalog } from '@/shared/entities/catalog.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  image: string;

  @Column({ type: 'jsonb', default: {} })
  title: Localized<string>;

  @Column({ type: 'jsonb', default: {} })
  description: Localized<string>;

  @Column({ type: 'jsonb', default: {} })
  compound: Localized<string[]>;

  @ManyToOne(() => Catalog, (catalog) => catalog.products)
  @JoinColumn({ name: 'catalog_id' })
  catalog: Catalog;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
