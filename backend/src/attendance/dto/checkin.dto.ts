import { IsInt, IsPositive, IsOptional } from 'class-validator';

export class CheckinDto {
  @IsInt()
  @IsPositive()
  shiftId: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  targetUserId?: number; // mark teammate; defaults to self
}
