import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true, unique: true })
  email!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({ nullable: true, unique: true })
  googleId!: string;

  @Column({ nullable: true, unique: true })
  microsoftId!: string;

  @Column({ default: 'user' })
  role!: string;

  @Column({ nullable: true })
  picture!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
