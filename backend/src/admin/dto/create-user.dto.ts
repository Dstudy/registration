import { IsString, IsNotEmpty, IsEmail, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  fullname: string;

  @IsString()
  @IsNotEmpty()
  ma_tnv: string;

  /** YYYY-MM-DD */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date_of_birth phải có định dạng YYYY-MM-DD' })
  date_of_birth: string;

  /** YYYY-MM-DD */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date_joined phải có định dạng YYYY-MM-DD' })
  date_joined: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
