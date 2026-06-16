import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pos_id', type: 'int', unique: true })
  posId: number;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ type: 'double precision', nullable: true })
  long: number | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ name: 'storage_id', type: 'int', nullable: true, default: null })
  storageId: number | null;

  @Column({ name: 'manager_name', type: 'text', nullable: true, default: null })
  managerName: string | null;

  @Column({ name: 'manager_phone', type: 'text', nullable: true, default: null })
  managerPhone: string | null;

  @Column({ name: 'is_working', default: true })
  isWorking: boolean;

  @Column({ name: 'open_time', type: 'varchar', length: 5, nullable: true, default: null })
  openTime: string | null;

  @Column({ name: 'close_time', type: 'varchar', length: 5, nullable: true, default: null })
  closeTime: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
