import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from '@/core/subscription/subscription.service';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { TelegramWebhookGuard } from '@/common/guards/telegram-webhook.guard';
// `import type` is required for types used in decorated signatures under isolatedModules +
// emitDecoratorMetadata, same as ReqUser elsewhere.
import type { TelegramUpdate } from '@/core/notify/types/telegram-update.type';

@ApiTags('Subscription')
@Controller('subscription/telegram')
export class SubscriptionTelegramController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Telegram posts every update here once setWebhook points at it. Public to the JWT guard
  // (Telegram sends no bearer token) but gated on the webhook secret instead. Not published
  // in Swagger — it isn't a client-facing endpoint.
  @Post('callback')
  @IsPublic()
  @UseGuards(TelegramWebhookGuard)
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleCallback(@Body() body: TelegramUpdate) {
    // Awaited rather than fired-and-forgotten: Telegram spins the pressed button until the
    // callback is answered, and retries the update if we don't return 200.
    await this.subscriptionService.handleTelegramCallback(body);

    return { ok: true };
  }
}
