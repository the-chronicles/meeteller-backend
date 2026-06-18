import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  invoiceNumber!: string;

  @Column('integer')
  amount!: number; // In kobo / cents

  @Column({ default: 'NGN' })
  currency!: string;

  @Column()
  planId!: string; // 'basic' | 'personal' | 'teams'

  @Column()
  billingCycle!: string; // 'monthly' | 'yearly'

  @Column()
  status!: string; // 'success' | 'failed'

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
