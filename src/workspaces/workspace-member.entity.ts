import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from '../users/user.entity';

@Entity()
@Unique(['workspace', 'user'])
export class WorkspaceMember {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  workspace!: Workspace;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ default: 'member' })
  role!: string; // 'owner' | 'admin' | 'member' | 'viewer'

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
