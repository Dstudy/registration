import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SystemConfigService } from '../../common/services/system-config.service';

export const REGISTRATION_WINDOW_QUEUE = 'registration-window';

@Processor(REGISTRATION_WINDOW_QUEUE)
export class RegistrationWindowProcessor extends WorkerHost {
  private readonly logger = new Logger(RegistrationWindowProcessor.name);

  constructor(private readonly systemConfig: SystemConfigService) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'open-registration') {
      await this.systemConfig.set('registration_open', 'true');
      this.logger.log('Đăng ký ca trực đã mở');
    } else if (job.name === 'close-registration') {
      await this.systemConfig.set('registration_open', 'false');
      this.logger.log('Đăng ký ca trực đã đóng');
    }
  }
}
