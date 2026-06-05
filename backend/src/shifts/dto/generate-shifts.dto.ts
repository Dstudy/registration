import { IsString, Matches } from 'class-validator';

export class GenerateShiftsDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month phải có định dạng YYYY-MM',
  })
  month: string;
}
