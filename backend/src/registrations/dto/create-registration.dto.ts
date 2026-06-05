import { IsInt, IsPositive } from 'class-validator';

export class CreateRegistrationDto {
  @IsInt()
  @IsPositive()
  shiftId: number;
}
