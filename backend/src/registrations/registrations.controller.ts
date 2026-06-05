import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateRegistrationDto) {
    return this.registrationsService.register(user.id, dto.shiftId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.registrationsService.cancel(user.id, id);
  }

  @Get('my')
  getMyRegistrations(
    @CurrentUser() user: JwtUser,
    @Query('upcoming') upcoming: string,
  ) {
    return this.registrationsService.findMyRegistrations(user.id, upcoming !== 'false');
  }

  @Public()
  @Get('status')
  async getStatus() {
    const isOpen = await this.registrationsService.isOpen();
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
    const targetMonth = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`;
    return { isOpen, targetMonth };
  }

  @Public()
  @Get('confirm')
  async confirm(@Query('token') token: string) {
    if (!token) throw new BadRequestException('Token xác nhận không được để trống');
    await this.registrationsService.confirmByToken(token);
    return { message: 'Xác nhận ca trực thành công' };
  }
}
