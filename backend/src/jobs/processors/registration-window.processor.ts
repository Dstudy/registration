import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { SystemConfigService } from '../../common/services/system-config.service';
import { RegistrationsService } from '../../registrations/registrations.service';

export const REGISTRATION_WINDOW_QUEUE = 'registration-window';

@Processor(REGISTRATION_WINDOW_QUEUE)
export class RegistrationWindowProcessor extends WorkerHost {
  private readonly logger = new Logger(RegistrationWindowProcessor.name);

  constructor(
    private readonly systemConfig: SystemConfigService,
    @Inject(forwardRef(() => RegistrationsService))
    private readonly registrationsService: RegistrationsService,
  ) {
    super();
  }

  async process(job: Job<{ month?: string }>) {
    if (job.name === 'open-registration') {
      await this.systemConfig.set('registration_open', 'true');
      this.logger.log('Đăng ký ca trực đã mở');
    } else if (job.name === 'close-registration') {
      await this.systemConfig.set('registration_open', 'false');
      this.logger.log('Đăng ký ca trực đã đóng');

      const targetMonth = job.data?.month || this.registrationsService.getDefaultTargetMonth();
      this.logger.log(`Bắt đầu tự động phân bổ ca trực cho TNV chọn 'Lịch nào cũng được' tháng ${targetMonth}`);
      try {
        const result = await this.registrationsService.autoFillFlexibleShifts(targetMonth);
        this.logger.log(
          `Hoàn tất tự động phân bổ: ${result.assignedCount} ca trực được gán cho ${result.volunteerCount} TNV`,
        );
      } catch (err) {
        this.logger.error(`Lỗi khi tự động phân bổ ca trực tháng ${targetMonth}: ${err.message}`, err.stack);
      }
    }
  }
}
