import { IsBoolean, IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { RequestType } from '@prisma/client';

export class CreateRequestDto {
  @IsEnum(RequestType)
  type: RequestType;

  @IsInt()
  @IsPositive()
  shiftIdFrom: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  shiftIdTo?: number; // required for SWAP

  @IsOptional()
  @IsInt()
  @IsPositive()
  receiverId?: number;

  @IsOptional()
  @IsString()
  receiverCode?: string; // alternative to receiverId — looked up by ma_tnv

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean; // for SUBSTITUTE: broadcast to marketplace

  @IsOptional()
  @IsString()
  note?: string;
}
