import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { businessTime } from '@/shared/utils/lib';

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // openTime/closeTime are bare `HH:mm` strings with no timezone attached, so they're read
  // as business-local wall-clock time. A branch with either bound unset has no configured
  // schedule and counts as always open, so existing branches keep working until an admin
  // sets both times.
  isOpenAt(at: Date = new Date()): boolean {
    if (!this.openTime || !this.closeTime) return true;

    const local = businessTime(at);
    const current = local.hour() * 60 + local.minute();
    const open = toMinutes(this.openTime);
    const close = toMinutes(this.closeTime);

    // A close time at or before the open time means the window crosses midnight
    // (e.g. 22:00–02:00); identical bounds therefore read as "open around the clock".
    return open < close ? current >= open && current < close : current >= open || current < close;
  }
}
