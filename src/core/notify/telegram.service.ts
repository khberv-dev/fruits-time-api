import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

// Telegram's HTML parse mode only needs these three escaped. Anything interpolated into a
// message from user data (names, addresses) must go through this or an unbalanced `<` will
// make the API reject the whole message.
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private apiClient: AxiosInstance | null = null;
  private chatId: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_GROUP_CHAT_ID');

    // Same posture as PushService: without credentials the notifier quietly no-ops rather
    // than taking the app down, so environments that don't have a group keep working.
    if (!token || !chatId) {
      this.logger.warn('TELEGRAM_BOT_TOKEN / TELEGRAM_GROUP_CHAT_ID not set — group notifications disabled');
      return;
    }

    this.chatId = chatId;
    this.apiClient = axios.create({ baseURL: `https://api.telegram.org/bot${token}` });
  }

  // Never throws: a notification failing must not fail the flow that triggered it.
  async sendMessage(text: string): Promise<void> {
    if (!this.apiClient || !this.chatId) return;

    try {
      await this.apiClient.post('/sendMessage', {
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    } catch (error) {
      this.logger.error(`sendMessage failed: ${this.formatError(error)}`);
    }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'no-status';
      const body = error.response?.data ? JSON.stringify(error.response.data) : 'no-body';
      return `[${status}] ${error.message} ${body}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
