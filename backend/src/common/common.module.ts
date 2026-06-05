import { Global, Module } from '@nestjs/common';
import { SystemConfigService } from './services/system-config.service';

@Global()
@Module({
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class CommonModule {}
