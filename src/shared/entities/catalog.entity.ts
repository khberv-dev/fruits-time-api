import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Localized } from '@/shared/types/localized.type';
import { Product } from '@/shared/entities/product.entity';

@Entity('catalogs')
export class Catalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  image: string;

  @Column({ type: 'jsonb', default: {} })
  title: Localized<string>;

  @OneToMany(() => Product, (product) => product.catalog)
  products: Product[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
