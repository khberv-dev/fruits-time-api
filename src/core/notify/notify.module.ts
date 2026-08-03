import { Module } from '@nestjs/common';
import { SmsService } from '@/core/notify/sms.service';
import { PushService } from '@/core/notify/push.service';
import { TelegramService } from '@/core/notify/telegram.service';

@Module({
  providers: [SmsService, PushService, TelegramService],
  exports: [SmsService, PushService, TelegramService],
})
export class NotifyModule {}
