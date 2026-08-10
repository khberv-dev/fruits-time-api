import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Guards the endpoint Telegram posts updates to. The secret is the one handed to
// setWebhook's `secret_token`, which Telegram then echoes on every call — note the header
// name is Telegram's own and differs from TelegramBotGuard's `x-telegram-bot-secret`,
// which protects our inbound registration endpoints instead.
@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers['x-telegram-bot-api-secret-token'];
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');

    // Refuse rather than wave everything through when unconfigured: an open webhook would
    // let anyone accept requests on the admins' behalf.
    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
