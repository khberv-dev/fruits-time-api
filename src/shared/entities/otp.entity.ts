import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('otp')
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column({ name: 'phone_number' })
  phoneNumber: string;

  @Column({ name: 'verified_at', nullable: true })
  verifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
