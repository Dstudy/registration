import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Role, ShiftPosition } from '@prisma/client';
import { ShiftsService } from './shifts.service';
import { GenerateShiftsDto } from './dto/generate-shifts.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('upcoming')
  findUpcoming() {
    return this.shiftsService.findUpcoming();
  }

  @Roles(Role.ADMIN)
  @Get('export')
  async exportExcel(
    @Query('month') month: string,
    @Query('position') position: string,
    @Res() res: Response,
  ) {
    const pos = position === 'PLACE_1' ? ShiftPosition.PLACE_1 : ShiftPosition.PLACE_2;
    const monthStr = month || new Date().toISOString().slice(0, 7);
    const buf = await this.shiftsService.exportCalendarExcel(monthStr, pos);
    const filename = `lich-${pos === ShiftPosition.PLACE_1 ? 'cs1' : 'cs2'}-${monthStr}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buf);
  }

  @Get()
  findByMonth(@Query('month') month: string, @CurrentUser() user: JwtUser) {
    const monthStr = month || new Date().toISOString().slice(0, 7);
    return this.shiftsService.findByMonth(monthStr, user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.shiftsService.findById(id);
  }

  @Roles(Role.ADMIN)
  @Post('generate')
  generate(@Body() dto: GenerateShiftsDto) {
    return this.shiftsService.generateMonthlyShifts(dto.month);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.shiftsService.toggleActive(id);
  }

  @Roles(Role.ADMIN)
  @Post('publish')
  publish(@Body() dto: GenerateShiftsDto) {
    return this.shiftsService.publishMonth(dto.month);
  }

  @Roles(Role.ADMIN)
  @Post('publish/:month')
  publishByParam(@Param('month') month: string) {
    return this.shiftsService.publishMonth(month);
  }
}
