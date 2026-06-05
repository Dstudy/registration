import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  ma_tnv: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
