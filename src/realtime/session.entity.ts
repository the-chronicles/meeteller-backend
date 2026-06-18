import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Meeting } from '../meetings/meeting.entity';

@Entity()
export class Session {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Meeting, {
    onDelete: 'CASCADE',
  })
  meeting!: Meeting;

  @Column({
    default: 'waiting',
  })
  status!: string;

  @Column({
    default: false,
  })
  isRecording!: boolean;

  @Column({
    default: false,
  })
  isTranscribing!: boolean;

  @Column({
    default: false,
  })
  isAiProcessing!: boolean;

  @Column({
    nullable: true,
  })
  startedAt!: Date;

  @Column({
    nullable: true,
  })
  endedAt!: Date;

  @Column({
    nullable: true,
  })
  reconnectToken!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
