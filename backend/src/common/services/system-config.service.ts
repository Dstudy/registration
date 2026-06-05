import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });
    return config?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async isRegistrationOpen(): Promise<boolean> {
    const value = await this.get('registration_open');
    return value === 'true';
  }

  async isShiftReminderEnabled(): Promise<boolean> {
    const value = await this.get('shift_reminder_enabled');
    return value === 'true';
  }
}
