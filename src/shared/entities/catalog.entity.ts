import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Localized } from '@/shared/types/localized.type';
import { Product } from '@/shared/entities/product.entity';
import { Locale } from '@/shared/enums/locale.enum';
import { getObjectDefaultValue } from '@/shared/utils/lib';
import { ProductType } from '@/shared/enums/product-type.enum';

@Entity('catalogs')
export class Catalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  image: string;

  @Column({ type: 'jsonb', default: {} })
  title: Localized<string>;

  @Column({ type: 'enum', enum: ProductType, default: ProductType.JUICE })
  type: ProductType;

  @OneToMany(() => Product, (product) => product.catalog)
  products: Product[];

  @Column({ default: 0 })
  index: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  getTitle(locale: Locale): string {
    return this.title[locale] ?? getObjectDefaultValue(this.title, '');
  }
}
