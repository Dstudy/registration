import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(actingUserId: number, shiftId: number, targetUserId?: number) {
    const userId = targetUserId ?? actingUserId;

    // Verify acting user is registered for this shift (for peer check-in validation)
    const actingReg = await this.prisma.registration.findUnique({
      where: { userId_shiftId: { userId: actingUserId, shiftId } },
    });
    if (!actingReg) {
      throw new ForbiddenException('Bạn không có trong ca trực này');
    }

    // Verify target user is registered for this shift
    const targetReg = await this.prisma.registration.findUnique({
      where: { userId_shiftId: { userId, shiftId } },
    });
    if (!targetReg) {
      throw new NotFoundException('Tình nguyện viên không có trong ca trực này');
    }

    // Verify shift date matches today
    const shift = await this.prisma.shiftInstance.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');

    const shiftDate = new Date(shift.date);
    const today = new Date();
    const isSameDay =
      shiftDate.getUTCFullYear() === today.getUTCFullYear() &&
      shiftDate.getUTCMonth() === today.getUTCMonth() &&
      shiftDate.getUTCDate() === today.getUTCDate();

    if (!isSameDay) {
      throw new BadRequestException('Chỉ có thể điểm danh vào ngày diễn ra ca trực');
    }

    return this.prisma.attendance.upsert({
      where: { userId_shiftId: { userId, shiftId } },
      update: { status: AttendanceStatus.PRESENT, updatedBy: actingUserId },
      create: {
        userId,
        shiftId,
        status: AttendanceStatus.PRESENT,
        updatedBy: actingUserId,
      },
    });
  }

  async adminOverride(adminId: number, attendanceId: number, status: AttendanceStatus, note?: string) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
    });
    if (!attendance) throw new NotFoundException('Không tìm thấy bản ghi điểm danh');

    return this.prisma.attendance.update({
      where: { id: attendanceId },
      data: { status, note: note ?? null, updatedBy: adminId },
    });
  }

  // Called by BullMQ job after each shift ends
  async autoMarkUnconfirmed(shiftId: number) {
    const registrations = await this.prisma.registration.findMany({
      where: { shiftId },
      select: { userId: true },
    });

    for (const reg of registrations) {
      await this.prisma.attendance.upsert({
        where: { userId_shiftId: { userId: reg.userId, shiftId } },
        update: {},
        create: {
          userId: reg.userId,
          shiftId,
          status: AttendanceStatus.UNCONFIRMED,
          updatedBy: 0,
        },
      });
    }
  }

  findByShift(shiftId: number) {
    return this.prisma.attendance.findMany({
      where: { shiftId },
      include: {
        user: { select: { id: true, ma_tnv: true, fullname: true } },
      },
    });
  }
}
