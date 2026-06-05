import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { RegistrationsModule } from '../registrations/registrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ShiftReminderScheduler } from '../jobs/schedulers/shift-reminder.scheduler';

@Module({
  imports: [RegistrationsModule, NotificationsModule, UsersModule],
  controllers: [AdminController],
  providers: [AdminService, ShiftReminderScheduler],
  exports: [AdminService],
})
export class AdminModule {}
