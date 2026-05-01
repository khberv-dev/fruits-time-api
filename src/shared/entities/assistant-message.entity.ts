import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '@/shared/entities/user.entity';
import { MessageRole } from '@/shared/enums/message-role.enum';

@Entity('assistant_messages')
@Index(['user', 'createdAt'])
export class AssistantMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column({ type: 'text' })
  text: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
