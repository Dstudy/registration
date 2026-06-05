import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationsService } from '../registrations/registrations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemConfigService } from '../common/services/system-config.service';
import { MailService } from '../mail/mail.service';
import { NotificationType, Role, UserStatus } from '@prisma/client';

const POSITION_LABELS: Record<string, string> = {
  PLACE_1: 'Địa điểm 1',
  PLACE_2: 'Địa điểm 2',
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registrations: RegistrationsService,
    private readonly notifications: NotificationsService,
    private readonly systemConfig: SystemConfigService,
    private readonly mail: MailService,
  ) {}

  async getDashboardStats(month: string) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [totalVolunteers, activeVolunteers, shiftsThisMonth, totalRegistrationsThisMonth, pendingRequests, todayAttendanceStats] =
      await Promise.all([
        this.prisma.user.count({ where: { role: Role.VOLUNTEER } }),
        this.prisma.user.count({ where: { role: Role.VOLUNTEER, status: UserStatus.ACTIVE } }),
        this.prisma.shiftInstance.count({ where: { date: { gte: startDate, lte: endDate } } }),
        this.prisma.registration.count({
          where: { shift: { date: { gte: startDate, lte: endDate } } },
        }),
        this.prisma.shiftRequest.count({ where: { status: 'ACCEPTED_BY_RECEIVER' } }),
        this.prisma.attendance.groupBy({
          by: ['status'],
          _count: { status: true },
          where: { shift: { date: { gte: todayStart, lte: todayEnd } } },
        }),
      ]);

    const todayMap = todayAttendanceStats.reduce(
      (acc, cur) => ({ ...acc, [cur.status]: cur._count.status }),
      {} as Record<string, number>,
    );

    return {
      totalVolunteers,
      activeVolunteers,
      shiftsThisMonth,
      totalRegistrationsThisMonth,
      pendingRequests,
      todayAttendance: {
        present: (todayMap['PRESENT'] || 0) + (todayMap['LATE'] || 0),
        absent: todayMap['ABSENT'] || 0,
        unconfirmed: todayMap['UNCONFIRMED'] || 0,
      },
    };
  }

  async getKpiList(month?: string) {
    const now = new Date();
    const currentMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, m] = currentMonth.split('-').map(Number);

    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    const volunteers = await this.prisma.user.findMany({
      where: { role: Role.VOLUNTEER, status: UserStatus.ACTIVE },
      include: {
        _count: {
          select: {
            registrations: {
              where: { shift: { date: { gte: startDate, lte: endDate } } },
            },
          },
        },
      },
    });

    return volunteers
      .filter((v) => v._count.registrations < v.min_shifts_per_month)
      .map((v) => ({
        id: v.id,
        ma_tnv: v.ma_tnv,
        fullname: v.fullname,
        shiftCount: v._count.registrations,
        minShifts: v.min_shifts_per_month,
        deficit: v.min_shifts_per_month - v._count.registrations,
      }))
      .sort((a, b) => b.deficit - a.deficit);
  }

  async bulkAssign(adminId: number, shiftId: number, maTnvList: string[]) {
    const results: { ma_tnv: string; status: 'added' | 'error'; message?: string }[] = [];

    for (const ma_tnv of maTnvList) {
      const trimmed = ma_tnv.trim();
      if (!trimmed) continue;

      try {
        const user = await this.prisma.user.findUnique({ where: { ma_tnv: trimmed } });
        if (!user) {
          results.push({ ma_tnv: trimmed, status: 'error', message: 'Không tìm thấy mã TNV' });
          continue;
        }
        if (user.status === UserStatus.INACTIVE) {
          results.push({ ma_tnv: trimmed, status: 'error', message: 'Tài khoản không hoạt động' });
          continue;
        }

        const reg = await this.registrations.adminAssign(adminId, shiftId, user.id);

        // Send notification
        await this.notifications.create(
          user.id,
          'Bạn được BNS xếp vào ca trực',
          `BNS đã thêm bạn vào ca trực. Vui lòng kiểm tra email để xác nhận.`,
          NotificationType.WARNING,
        );

        results.push({ ma_tnv: trimmed, status: 'added' });
      } catch (err) {
        results.push({ ma_tnv: trimmed, status: 'error', message: err.message });
      }
    }

    return {
      shiftId,
      results,
      added: results.filter((r) => r.status === 'added').length,
      errors: results.filter((r) => r.status === 'error').length,
    };
  }

  async getAttendanceByDate(date: string) {
    const d = new Date(date);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);

    const records = await this.prisma.attendance.findMany({
      where: { shift: { date: { gte: d, lt: next } } },
      include: {
        user: { select: { id: true, ma_tnv: true, fullname: true } },
        shift: { select: { id: true, shiftName: true, position: true, startTime: true, endTime: true } },
      },
      orderBy: { shift: { startTime: 'asc' } },
    });

    return { records, date };
  }

  async getVolunteers(search?: string) {
    const volunteers = await this.prisma.user.findMany({
      where: {
        role: Role.VOLUNTEER,
        ...(search
          ? {
              OR: [
                { ma_tnv: { contains: search } },
                { fullname: { contains: search } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { registrations: true } } },
      orderBy: { ma_tnv: 'asc' },
    });

    return { volunteers };
  }

  async confirmRegistration(registrationId: number) {
    return this.registrations.confirmByAdmin(registrationId);
  }

  async confirmAllRegistrations(shiftId: number) {
    return this.registrations.confirmAllByShift(shiftId);
  }

  async confirmAllForMonth(month: string) {
    return this.registrations.confirmAllForMonth(month);
  }

  async cancelRegistration(registrationId: number) {
    return this.registrations.cancelByAdmin(registrationId);
  }

  async getRegistrationStatus(): Promise<{ open: boolean }> {
    const open = await this.systemConfig.isRegistrationOpen();
    return { open };
  }

  async setRegistrationStatus(open: boolean): Promise<{ open: boolean }> {
    await this.systemConfig.set('registration_open', open ? 'true' : 'false');
    return { open };
  }

  async getReminderStatus(): Promise<{ enabled: boolean }> {
    const enabled = await this.systemConfig.isShiftReminderEnabled();
    return { enabled };
  }

  async setReminderStatus(enabled: boolean): Promise<{ enabled: boolean }> {
    await this.systemConfig.set('shift_reminder_enabled', enabled ? 'true' : 'false');
    return { enabled };
  }

  async updateVolunteer(id: number, body: { status?: string; min_shifts_per_month?: number }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status as UserStatus } : {}),
        ...(body.min_shifts_per_month !== undefined ? { min_shifts_per_month: body.min_shifts_per_month } : {}),
      },
      select: { id: true, ma_tnv: true, fullname: true, status: true, min_shifts_per_month: true },
    });
  }

  async sendConfirmationEmailsForMonth(month: string): Promise<{ sent: number; skipped: number; alreadySent: number; errors: number }> {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    // Atomically claim all unsent registrations before doing anything else.
    // Two concurrent requests will race on this UPDATE — the database serializes
    // row-level locks, so only one request will claim each row; the other sees 0.
    const claimedAt = new Date();
    const claimResult = await this.prisma.registration.updateMany({
      where: {
        isConfirmed: true,
        emailSentAt: null,
        shift: { date: { gte: startDate, lte: endDate } },
      },
      data: { emailSentAt: claimedAt },
    });

    // Count how many were already sent before this request ran
    const totalConfirmed = await this.prisma.registration.count({
      where: {
        isConfirmed: true,
        shift: { date: { gte: startDate, lte: endDate } },
      },
    });
    const alreadySentCount = totalConfirmed - claimResult.count;

    if (claimResult.count === 0) {
      return { sent: 0, skipped: 0, alreadySent: alreadySentCount > 0 ? 1 : 0, errors: 0 };
    }

    // Fetch only the records this request just claimed
    const registrations = await this.prisma.registration.findMany({
      where: {
        isConfirmed: true,
        emailSentAt: claimedAt,
        shift: { date: { gte: startDate, lte: endDate } },
      },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        shift: { select: { date: true, shiftName: true, position: true, startTime: true, endTime: true } },
      },
      orderBy: { shift: { date: 'asc' } },
    });

    // Group by userId
    const byUser = new Map<number, typeof registrations>();
    for (const reg of registrations) {
      const list = byUser.get(reg.userId) ?? [];
      list.push(reg);
      byUser.set(reg.userId, list);
    }

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    const pad = (n: number) => String(n).padStart(2, '0');

    for (const [, regs] of byUser) {
      const user = regs[0].user;

      if (!user.email) {
        // Release the claim so a future run can retry once they have an email
        await this.prisma.registration.updateMany({
          where: { id: { in: regs.map((r) => r.id) } },
          data: { emailSentAt: null },
        });
        skipped++;
        continue;
      }

      try {
        const shifts = regs.map((reg) => {
          const shiftDate = new Date(reg.shift.date);
          const startTime = new Date(reg.shift.startTime);
          const endTime = new Date(reg.shift.endTime);

          // Times are stored as Vietnam local hours (UTC+7), so subtract 7 to get real UTC
          const startDateTimeUtc = new Date(Date.UTC(
            shiftDate.getUTCFullYear(), shiftDate.getUTCMonth(), shiftDate.getUTCDate(),
            startTime.getUTCHours() - 7, startTime.getUTCMinutes(), 0,
          ));
          const endDateTimeUtc = new Date(Date.UTC(
            shiftDate.getUTCFullYear(), shiftDate.getUTCMonth(), shiftDate.getUTCDate(),
            endTime.getUTCHours() - 7, endTime.getUTCMinutes(), 0,
          ));

          return {
            registrationId: reg.id,
            shiftDate: `${pad(shiftDate.getUTCDate())}/${pad(shiftDate.getUTCMonth() + 1)}/${shiftDate.getUTCFullYear()}`,
            shiftName: reg.shift.shiftName,
            positionLabel: POSITION_LABELS[reg.shift.position] ?? reg.shift.position,
            startTimeLabel: `${pad(startTime.getUTCHours())}:${pad(startTime.getUTCMinutes())}`,
            endTimeLabel: `${pad(endTime.getUTCHours())}:${pad(endTime.getUTCMinutes())}`,
            startDateTimeUtc,
            endDateTimeUtc,
          };
        });

        await this.mail.sendShiftAssignmentEmail({
          to: user.email,
          fullname: user.fullname,
          shifts,
        });

        sent++;
      } catch {
        // Release claim so a future retry can resend for this volunteer
        await this.prisma.registration.updateMany({
          where: { id: { in: regs.map((r) => r.id) } },
          data: { emailSentAt: null },
        });
        errors++;
      }
    }

    return { sent, skipped, alreadySent: alreadySentCount > 0 ? 1 : 0, errors };
  }

  async validateBulkAssign(shiftId: number, maTnvList: string[]) {
    const preview: { ma_tnv: string; fullname?: string; valid: boolean; reason?: string }[] = [];

    for (const ma_tnv of maTnvList) {
      const trimmed = ma_tnv.trim();
      if (!trimmed) continue;

      const user = await this.prisma.user.findUnique({ where: { ma_tnv: trimmed } });
      if (!user) {
        preview.push({ ma_tnv: trimmed, valid: false, reason: 'Không tìm thấy mã TNV' });
        continue;
      }

      const existing = await this.prisma.registration.findUnique({
        where: { userId_shiftId: { userId: user.id, shiftId } },
      });

      if (existing) {
        preview.push({ ma_tnv: trimmed, fullname: user.fullname, valid: false, reason: 'Đã có trong ca trực' });
      } else {
        preview.push({ ma_tnv: trimmed, fullname: user.fullname, valid: true });
      }
    }

    return preview;
  }
}
