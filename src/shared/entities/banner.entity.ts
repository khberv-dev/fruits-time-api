import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Localized } from '@/shared/types/localized.type';
import { Locale } from '@/shared/enums/locale.enum';
import { getObjectDefaultValue } from '@/shared/utils/lib';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', default: {} })
  image: Localized<string>;

  @Column({ type: 'jsonb', default: {} })
  title: Localized<string>;

  @Column({ type: 'jsonb', default: {} })
  content: Localized<string>;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  getTitle(locale: Locale): string {
    return this.title[locale] ?? getObjectDefaultValue(this.title, '');
  }

  getContent(locale: Locale): string {
    return this.content[locale] ?? getObjectDefaultValue(this.content, '');
  }

  getImage(locale: Locale): string {
    return this.image[locale] ?? getObjectDefaultValue(this.image, '');
  }
}
