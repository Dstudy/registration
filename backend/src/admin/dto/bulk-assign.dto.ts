import { IsArray, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class BulkAssignDto {
  @IsInt()
  @IsPositive()
  shiftId: number;

  @IsArray()
  @IsString({ each: true })
  maTnvList: string[];

  @IsOptional()
  preview?: boolean;
}
