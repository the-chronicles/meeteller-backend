import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Column,
  CreateDateColumn,
} from 'typeorm';

import { Meeting } from '../meetings/meeting.entity';
import { Session } from '../realtime/session.entity';
import { TranscriptSegment } from './transcript-segment.entity';

@Entity()
export class Transcript {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Meeting, {
    onDelete: 'CASCADE',
  })
  meeting!: Meeting;

  @ManyToOne(() => Session, {
    onDelete: 'CASCADE',
  })
  session!: Session;

  @Column({
    default: 'processing',
  })
  status!: string;

  @OneToMany(() => TranscriptSegment, (segment) => segment.transcript)
  segments!: TranscriptSegment[];

  @CreateDateColumn()
  createdAt!: Date;
}
