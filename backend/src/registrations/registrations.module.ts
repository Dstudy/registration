import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationWindowProcessor, REGISTRATION_WINDOW_QUEUE } from '../jobs/processors/registration-window.processor';
import { RegistrationScheduler } from '../jobs/schedulers/registration.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({
      name: REGISTRATION_WINDOW_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  controllers: [RegistrationsController],
  providers: [
    RegistrationsService,
    RegistrationWindowProcessor,
    RegistrationScheduler,
  ],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
