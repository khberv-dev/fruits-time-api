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
import { Locale } from '@/shared/enums/locale.enum';
import { getObjectDefaultValue } from '@/shared/utils/lib';
import { ProductType } from '@/shared/enums/product-type.enum';

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

  @Column({ default: 0 })
  price: number;

  @Column({ type: 'enum', enum: ProductType, default: ProductType.JUICE })
  type: ProductType;

  @ManyToOne(() => Catalog, (catalog) => catalog.products)
  @JoinColumn({ name: 'catalog_id' })
  catalog: Catalog;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  getTitle(locale: Locale): string {
    return this.title[locale] ?? getObjectDefaultValue(this.title, '');
  }

  getDescription(locale: Locale): string {
    return this.description[locale] ?? getObjectDefaultValue(this.description, '');
  }

  getCompound(locale: Locale): string[] {
    return this.compound[locale] ?? getObjectDefaultValue(this.compound, []);
  }
}
