import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { REGISTRATION_WINDOW_QUEUE } from '../processors/registration-window.processor';
import { SystemConfigService } from '../../common/services/system-config.service';

@Injectable()
export class RegistrationScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RegistrationScheduler.name);

  constructor(
    @InjectQueue(REGISTRATION_WINDOW_QUEUE) private readonly windowQueue: Queue,
    private readonly systemConfig: SystemConfigService,
  ) {}

  // Also runs on startup so the flag is correct even after a mid-month restart
  async onApplicationBootstrap() {
    await this.scheduleMonthlyRegistrationWindow();
  }

  // Runs at midnight on the 1st of every month — schedules open/close for this month
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async scheduleMonthlyRegistrationWindow() {
    const isTestEnv = process.env.NODE_ENV !== 'production';
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const day = now.getUTCDate();

    // In non-production environments the window spans the entire month (day 1 → last day)
    const openDay = isTestEnv ? 1 : 20;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const closeDay = isTestEnv ? lastDay : 25;

    const openDate = new Date(Date.UTC(year, month, openDay, 0, 0, 0));
    const closeDate = new Date(Date.UTC(year, month, closeDay, 23, 59, 59));
    const nowMs = Date.now();

    if (isTestEnv) {
      this.logger.warn(`[TEST MODE] Cửa sổ đăng ký: ngày ${openDay}–${closeDay} tháng ${month + 1}`);
    }

    // If we're currently inside the window, set the flag immediately
    if (day >= openDay && day <= closeDay) {
      await this.systemConfig.set('registration_open', 'true');
      this.logger.log('Đang trong thời gian đăng ký — đã mở ngay lập tức');
    } else if (day > closeDay) {
      await this.systemConfig.set('registration_open', 'false');
      this.logger.log('Đã qua thời gian đăng ký tháng này — đã đóng');
    }

    if (openDate.getTime() > nowMs) {
      const delay = openDate.getTime() - nowMs;
      await this.windowQueue.add('open-registration', {}, { delay, jobId: `open-${year}-${month + 1}` });
      this.logger.log(`Đã lên lịch mở đăng ký: ${openDate.toISOString()}`);
    }

    if (closeDate.getTime() > nowMs) {
      const delay = closeDate.getTime() - nowMs;
      await this.windowQueue.add('close-registration', {}, { delay, jobId: `close-${year}-${month + 1}` });
      this.logger.log(`Đã lên lịch đóng đăng ký: ${closeDate.toISOString()}`);
    }
  }
}
