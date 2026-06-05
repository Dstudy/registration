import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { CheckinDto } from './dto/checkin.dto';
import { OverrideAttendanceDto } from './dto/override-attendance.dto';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('checkin')
  @HttpCode(HttpStatus.OK)
  checkIn(@CurrentUser() user: JwtUser, @Body() dto: CheckinDto) {
    return this.attendanceService.checkIn(user.id, dto.shiftId, dto.targetUserId);
  }

  @Get('shift/:shiftId')
  findByShift(@Param('shiftId', ParseIntPipe) shiftId: number) {
    return this.attendanceService.findByShift(shiftId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/override')
  override(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OverrideAttendanceDto,
  ) {
    return this.attendanceService.adminOverride(user.id, id, dto.status, dto.note);
  }
}
