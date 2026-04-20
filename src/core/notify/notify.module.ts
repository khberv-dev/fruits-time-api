import { Module } from '@nestjs/common';
import { SmsService } from '@/core/notify/sms.service';

@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class NotifyModule {}
