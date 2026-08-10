import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

// Telegram's HTML parse mode only needs these three escaped. Anything interpolated into a
// message from user data (names, addresses) must go through this or an unbalanced `<` will
// make the API reject the whole message.
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Telegram caps callback_data at 64 bytes, so keep the prefix short — `<action>:<uuid>`
// leaves plenty of room.
export interface InlineButton {
  text: string;
  callbackData: string;
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
  // `buttons` is a grid — each inner array is one row of inline buttons.
  async sendMessage(text: string, buttons?: InlineButton[][]): Promise<void> {
    if (!this.apiClient || !this.chatId) return;

    try {
      await this.apiClient.post('/sendMessage', {
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(buttons?.length ? { reply_markup: { inline_keyboard: this.toInlineKeyboard(buttons) } } : {}),
      });
    } catch (error) {
      this.logger.error(`sendMessage failed: ${this.formatError(error)}`);
    }
  }

  // Telegram shows a spinner on the pressed button until this is answered, so it should be
  // called on every callback — including ones we reject.
  async answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
    if (!this.apiClient) return;

    try {
      await this.apiClient.post('/answerCallbackQuery', { callback_query_id: callbackQueryId, text });
    } catch (error) {
      this.logger.error(`answerCallbackQuery failed: ${this.formatError(error)}`);
    }
  }

  // Rewrites an already-posted message, typically to record the outcome and drop the
  // buttons so the action can't be triggered twice from the same post.
  async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    buttons?: InlineButton[][],
  ): Promise<void> {
    if (!this.apiClient) return;

    try {
      await this.apiClient.post('/editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: this.toInlineKeyboard(buttons ?? []) },
      });
    } catch (error) {
      this.logger.error(`editMessageText failed: ${this.formatError(error)}`);
    }
  }

  private toInlineKeyboard(buttons: InlineButton[][]) {
    return buttons.map((row) => row.map((button) => ({ text: button.text, callback_data: button.callbackData })));
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
