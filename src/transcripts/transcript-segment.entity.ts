import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

import { Transcript } from './transcript.entity';

@Entity()
export class TranscriptSegment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Transcript, {
    onDelete: 'CASCADE',
  })
  transcript!: Transcript;

  @Column('text')
  text!: string;

  @Column({
    nullable: true,
  })
  speaker!: string;

  @Column({
    nullable: true,
  })
  startTime!: number;

  @Column({
    nullable: true,
  })
  endTime!: number;

  @Column({
    default: false,
  })
  isFinal!: boolean;

  @Column({
    type: 'vector',
    length: 1536,
    nullable: true,
  })
  embedding?: number[] | null;

  @CreateDateColumn()
  createdAt!: Date;
}
