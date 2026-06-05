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
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateRequestDto) {
    return this.requestsService.createRequest(user.id, dto);
  }

  @Get('my')
  findMy(@CurrentUser() user: JwtUser) {
    return this.requestsService.findForUser(user.id);
  }

  @Get('marketplace')
  findMarketplace(@CurrentUser() user: JwtUser) {
    return this.requestsService.findPublicRequests(user.id);
  }

  @Get('public')
  findPublic(@CurrentUser() user: JwtUser) {
    return this.requestsService.findPublicRequests(user.id);
  }

  @Roles(Role.ADMIN)
  @Get('admin/pending')
  findPendingForAdmin() {
    return this.requestsService.findPendingForAdmin();
  }

  @Patch(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.requestsService.acceptRequest(user.id, id);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.requestsService.rejectRequest(user.id, id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.requestsService.cancelRequest(user.id, id);
  }

  @Patch(':id/take')
  @HttpCode(HttpStatus.OK)
  take(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.requestsService.takePublicRequest(user.id, id);
  }

  @Roles(Role.ADMIN)
  @Get('admin/all')
  findAllForAdmin() {
    return this.requestsService.findAllForAdmin();
  }

  @Roles(Role.ADMIN)
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.requestsService.adminApprove(user.id, id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/admin-reject')
  @HttpCode(HttpStatus.OK)
  adminReject(@Param('id', ParseIntPipe) id: number) {
    return this.requestsService.adminReject(id);
  }
}
