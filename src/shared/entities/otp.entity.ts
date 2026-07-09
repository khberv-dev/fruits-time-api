import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('otp_codes')
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_number' })
  phoneNumber: string;

  @Column()
  code: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
