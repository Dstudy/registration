import { Controller, Get, Post, Patch, Delete, Body, Query, Param, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { BulkAssignDto } from './dto/bulk-assign.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
  ) {}

  @Get('registration-status')
  getRegistrationStatus() {
    return this.adminService.getRegistrationStatus();
  }

  @Patch('registration-status')
  setRegistrationStatus(@Body() body: { open: boolean }) {
    return this.adminService.setRegistrationStatus(body.open);
  }

  @Get('reminder-status')
  getReminderStatus() {
    return this.adminService.getReminderStatus();
  }

  @Patch('reminder-status')
  setReminderStatus(@Body() body: { enabled: boolean }) {
    return this.adminService.setReminderStatus(body.enabled);
  }

  @Get('stats')
  getDashboardStats(@Query('month') month?: string) {
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    return this.adminService.getDashboardStats(currentMonth);
  }

  @Get('kpi')
  getKpiList(@Query('month') month?: string) {
    return this.adminService.getKpiList(month);
  }

  @Get('attendance')
  getAttendanceByDate(@Query('date') date: string) {
    return this.adminService.getAttendanceByDate(date);
  }

  @Get('volunteers')
  getVolunteers(@Query('search') search?: string) {
    return this.adminService.getVolunteers(search);
  }

  @Patch('volunteers/:id')
  updateVolunteer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string; min_shifts_per_month?: number },
  ) {
    return this.adminService.updateVolunteer(id, body);
  }

  @Post('send-confirmation-emails')
  sendConfirmationEmails(@Body() body: { month: string }) {
    return this.adminService.sendConfirmationEmailsForMonth(body.month);
  }

  @Patch('registrations/confirm-month')
  confirmMonth(@Body() body: { month: string }) {
    return this.adminService.confirmAllForMonth(body.month);
  }

  @Patch('registrations/confirm-all')
  confirmAll(@Body() body: { shiftId: number }) {
    return this.adminService.confirmAllRegistrations(body.shiftId);
  }

  @Patch('registrations/:id/confirm')
  confirmRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.confirmRegistration(id);
  }

  @Delete('registrations/:id')
  cancelRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.cancelRegistration(id);
  }

  @Post('assignments/preview')
  previewAssign(@Body() body: { shiftId: number; codes: string[] }) {
    return this.adminService.validateBulkAssign(body.shiftId, body.codes);
  }

  @Post('assignments')
  assign(@CurrentUser() user: JwtUser, @Body() body: { shiftId: number; codes: string[] }) {
    return this.adminService.bulkAssign(user.id, body.shiftId, body.codes);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Post('users/import')
  @UseInterceptors(FileInterceptor('file'))
  async importUsers(@UploadedFile() file: { buffer: Buffer; originalname: string }) {
    if (!file) throw new BadRequestException('Vui lòng tải lên file CSV');
    const csv = file.buffer.toString('utf-8');
    return this.usersService.bulkCreateFromCsv(csv);
  }

  /** Legacy bulk-assign endpoint */
  @Post('bulk-assign')
  bulkAssign(@CurrentUser() user: JwtUser, @Body() dto: BulkAssignDto) {
    if (dto.preview) {
      return this.adminService.validateBulkAssign(dto.shiftId, dto.maTnvList);
    }
    return this.adminService.bulkAssign(user.id, dto.shiftId, dto.maTnvList);
  }
}
