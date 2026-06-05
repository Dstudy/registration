import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { SystemConfigService } from '../../common/services/system-config.service';

const POSITION_LABELS: Record<string, string> = {
  PLACE_1: 'Địa điểm 1',
  PLACE_2: 'Địa điểm 2',
};

@Injectable()
export class ShiftReminderScheduler {
  private readonly logger = new Logger(ShiftReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  @Cron('*/15 * * * *')
  async sendShiftReminders() {
    const enabled = await this.systemConfig.isShiftReminderEnabled();
    if (!enabled) return;

    const now = new Date();
    // 30-minute window centered at 2 hours from now: [now+1h45m, now+2h15m]
    const windowStart = new Date(now.getTime() + 105 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 135 * 60 * 1000);

    // Only query shifts on today or tomorrow (UTC) to cover any 2-hour lookahead
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayAfterTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));

    const registrations = await this.prisma.registration.findMany({
      where: {
        isConfirmed: true,
        reminderSentAt: null,
        shift: {
          isActive: true,
          date: { gte: todayUtc, lt: dayAfterTomorrow },
        },
      },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        shift: { select: { date: true, shiftName: true, position: true, startTime: true } },
      },
    });

    const pad = (n: number) => String(n).padStart(2, '0');
    let sent = 0;

    for (const reg of registrations) {
      const shiftDate = new Date(reg.shift.date);
      const startTime = new Date(reg.shift.startTime);

      // Times stored as Vietnam local (UTC+7), subtract 7 to get real UTC
      const shiftUtcStart = new Date(
        Date.UTC(
          shiftDate.getUTCFullYear(),
          shiftDate.getUTCMonth(),
          shiftDate.getUTCDate(),
          startTime.getUTCHours() - 7,
          startTime.getUTCMinutes(),
          0,
        ),
      );

      if (shiftUtcStart < windowStart || shiftUtcStart > windowEnd) continue;
      if (!reg.user.email) continue;

      // Atomically claim this registration to prevent double-send on concurrent runs
      const claimed = await this.prisma.registration.updateMany({
        where: { id: reg.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claimed.count === 0) continue;

      await this.mail.sendShiftReminder({
        to: reg.user.email,
        fullname: reg.user.fullname,
        shiftDate: `${pad(shiftDate.getUTCDate())}/${pad(shiftDate.getUTCMonth() + 1)}/${shiftDate.getUTCFullYear()}`,
        shiftName: reg.shift.shiftName,
        startTime: `${pad(startTime.getUTCHours())}:${pad(startTime.getUTCMinutes())}`,
        position: POSITION_LABELS[reg.shift.position] ?? reg.shift.position,
      });

      sent++;
    }

    if (sent > 0) {
      this.logger.log(`Đã gửi ${sent} email nhắc nhở ca trực`);
    }
  }
}
