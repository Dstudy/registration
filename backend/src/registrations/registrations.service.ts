import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../common/services/system-config.service';
import { RegistrationType } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  // ─── Volunteer Self-Registration ────────────

  async register(userId: number, shiftId: number) {
    const isOpen = await this.systemConfig.isRegistrationOpen();
    if (!isOpen) {
      throw new ForbiddenException('Ngoài thời gian đăng ký ca trực');
    }

    // Race-condition-safe transaction with row-level lock
    return this.prisma.$transaction(
      async (tx) => {
        // Lock the shift row before counting
        const shifts = await tx.$queryRaw<Array<{
          id: number;
          isActive: boolean;
          isPublished: boolean;
          maxSlots: number;
          date: Date;
          shiftName: string;
        }>>`
          SELECT id, isActive, isPublished, maxSlots, date, shiftName
          FROM ShiftInstance
          WHERE id = ${shiftId}
          FOR UPDATE
        `;

        const shift = shifts[0];
        if (!shift) throw new NotFoundException('Không tìm thấy ca trực');
        if (!shift.isActive) throw new ForbiddenException('Ca trực không hoạt động');
        if (!shift.isPublished) throw new ForbiddenException('Ca trực chưa được công bố');

        const registrationCount = await tx.registration.count({
          where: { shiftId },
        });

        if (registrationCount >= shift.maxSlots) {
          throw new ConflictException('Ca trực đã đầy');
        }

        const existing = await tx.registration.findUnique({
          where: { userId_shiftId: { userId, shiftId } },
        });
        if (existing) throw new ConflictException('Bạn đã đăng ký ca trực này');

        await this.checkSameShiftConflict(tx, userId, shiftId, shift.date, shift.shiftName);

        const confirmationToken = crypto.randomBytes(32).toString('hex');

        return tx.registration.create({
          data: {
            userId,
            shiftId,
            registrationType: RegistrationType.SELF,
            isConfirmed: false,
            confirmationToken,
          },
          include: {
            shift: { select: { date: true, shiftName: true, position: true, startTime: true } },
          },
        });
      },
      { timeout: 5000 },
    );
  }

  // ─── Admin Bulk Assignment ───────────────────

  async adminAssign(adminId: number, shiftId: number, userId: number) {
    const shift = await this.prisma.shiftInstance.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');
    if (!shift.isActive) throw new ForbiddenException('Ca trực không hoạt động');

    const count = await this.prisma.registration.count({ where: { shiftId } });
    if (count >= shift.maxSlots) throw new ConflictException('Ca trực đã đầy');

    const existing = await this.prisma.registration.findUnique({
      where: { userId_shiftId: { userId, shiftId } },
    });
    if (existing) throw new ConflictException('TNV đã có trong ca trực này');

    await this.checkSameShiftConflict(this.prisma, userId, shiftId, shift.date, shift.shiftName);

    const confirmationToken = crypto.randomBytes(32).toString('hex');

    return this.prisma.registration.create({
      data: {
        userId,
        shiftId,
        registrationType: RegistrationType.BNS_ASSIGNED,
        isConfirmed: false,
        confirmationToken,
      },
    });
  }

  // ─── Cancel ─────────────────────────────────

  async cancel(userId: number, registrationId: number) {
    const reg = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { shift: true },
    });

    if (!reg) throw new NotFoundException('Không tìm thấy đăng ký');
    if (reg.userId !== userId) throw new ForbiddenException('Không có quyền hủy đăng ký này');

    const now = new Date();
    if (reg.shift.date < now) {
      throw new BadRequestException('Không thể hủy ca trực đã qua');
    }

    return this.prisma.registration.delete({ where: { id: registrationId } });
  }

  // ─── Email Confirmation via Token ───────────

  async confirmByToken(token: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { confirmationToken: token },
    });

    if (!registration) {
      throw new NotFoundException('Token xác nhận không hợp lệ hoặc đã hết hạn');
    }

    return this.prisma.registration.update({
      where: { id: registration.id },
      data: { isConfirmed: true, confirmationToken: null },
    });
  }

  // ─── Admin Confirmation ──────────────────────

  async confirmByAdmin(registrationId: number) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) throw new NotFoundException('Không tìm thấy đăng ký');

    return this.prisma.registration.update({
      where: { id: registrationId },
      data: { isConfirmed: true, confirmationToken: null },
    });
  }

  async confirmAllByShift(shiftId: number) {
    const shift = await this.prisma.shiftInstance.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');

    const result = await this.prisma.registration.updateMany({
      where: { shiftId, isConfirmed: false },
      data: { isConfirmed: true, confirmationToken: null },
    });

    return { confirmed: result.count, shiftId };
  }

  async confirmAllForMonth(month: string) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    const result = await this.prisma.registration.updateMany({
      where: {
        isConfirmed: false,
        shift: { date: { gte: startDate, lte: endDate } },
      },
      data: { isConfirmed: true, confirmationToken: null },
    });

    return { confirmed: result.count, month };
  }

  async cancelByAdmin(registrationId: number) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) throw new NotFoundException('Không tìm thấy đăng ký');
    return this.prisma.registration.delete({ where: { id: registrationId } });
  }

  isOpen() {
    return this.systemConfig.isRegistrationOpen();
  }

  private async checkSameShiftConflict(
    client: any,
    userId: number,
    targetShiftId: number,
    targetDate: Date,
    targetShiftName: string,
  ): Promise<void> {
    const conflict = await client.registration.findFirst({
      where: {
        userId,
        shiftId: { not: targetShiftId },
        shift: { date: targetDate, shiftName: targetShiftName },
      },
    });
    if (conflict) {
      throw new ConflictException('Bạn đã có ca trực cùng thời gian tại địa điểm khác');
    }
  }

  // ─── Queries ────────────────────────────────

  findMyRegistrations(userId: number, upcoming: boolean) {
    const now = new Date();
    return this.prisma.registration.findMany({
      where: {
        userId,
        shift: upcoming ? { date: { gte: now } } : { date: { lt: now } },
      },
      include: {
        shift: true,
      },
      orderBy: { shift: { date: upcoming ? 'asc' : 'desc' } },
    });
  }

  findByShift(shiftId: number) {
    return this.prisma.registration.findMany({
      where: { shiftId },
      include: {
        user: { select: { id: true, ma_tnv: true, fullname: true } },
      },
    });
  }
}
