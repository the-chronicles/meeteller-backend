import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Meeting } from 'src/meetings/meeting.entity';

@Entity()
export class MeetingInsight {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Meeting, {
    onDelete: 'CASCADE',
  })
  meeting!: Meeting;

  @Column('text')
  summary!: string;

  @Column('jsonb')
  actionItems!: string[];

  @Column('jsonb')
  keyDecisions!: string[];

  @Column({
    nullable: true,
  })
  suggestedTitle!: string;

  @Column('jsonb', {
    default: [],
  })
  tags!: string[];

  @CreateDateColumn()
  createdAt!: Date;
}
