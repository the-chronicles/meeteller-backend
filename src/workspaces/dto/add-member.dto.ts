import { IsNotEmpty, IsEmail, IsString } from 'class-validator';

export class AddMemberDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  role!: string;
}
