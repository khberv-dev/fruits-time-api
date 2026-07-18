import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class TelegramBotGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers['x-telegram-bot-secret'];

    if (!secret || secret !== this.config.getOrThrow('TELEGRAM_BOT_SECRET')) {
      throw new UnauthorizedException('Invalid bot secret');
    }

    return true;
  }
}
