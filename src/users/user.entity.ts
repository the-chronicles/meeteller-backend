import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true, unique: true })
  email!: string;

  @Column({
    nullable: true,
  })
  password!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({ nullable: true, unique: true })
  googleId!: string;

  @Column({ nullable: true, unique: true })
  microsoftId!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  resetToken!: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  resetTokenExpiry!: Date | null;

  @Column({ default: 'user' })
  role!: string;

  @Column({ nullable: true })
  picture!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({
    nullable: true,
  })
  bio!: string;

  @Column({
    nullable: true,
  })
  timezone!: string;

  @Column({
    default: false,
  })
  onboardingCompleted!: boolean;

  @Column({
    default: 'free',
  })
  subscriptionPlan!: string;
}
