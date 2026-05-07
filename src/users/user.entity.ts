import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  googleId: string;

  @Column({ nullable: true })
  microsoftId: string;

  @Column({ default: 'user' })
  role: string;
}
