import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

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
