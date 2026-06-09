import { Module } from '@nestjs/common';
import { SmsService } from '@/core/notify/sms.service';
import { PushService } from '@/core/notify/push.service';

@Module({
  providers: [SmsService, PushService],
  exports: [SmsService, PushService],
})
export class NotifyModule {}
