import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { Workspace } from '../workspaces/workspace.entity';

@Entity()
export class Meeting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({
    nullable: true,
  })
  description!: string;

  @Column({
    default: 'scheduled',
  })
  status!: string;

  @Column({
    nullable: true,
  })
  startedAt!: Date;

  @Column({
    nullable: true,
  })
  endedAt!: Date;

  @Column({
    default: false,
  })
  isRecording!: boolean;

  @Column({
    default: false,
  })
  isLive!: boolean;

  @ManyToOne(() => User, (user) => user.id, {
    // eager: true,
    onDelete: 'CASCADE',
  })
  owner!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({
    default: 'internal',
  })
  meetingType!: string;

  @Column({
    nullable: true,
  })
  externalMeetingId!: string;

  @Column({
    nullable: true,
  })
  externalMeetingUrl!: string;

  @Column({
    nullable: true,
  })
  providerMetadata!: string;

  @ManyToOne(() => Workspace, { nullable: true, onDelete: 'SET NULL' })
  workspace?: Workspace | null;
}
