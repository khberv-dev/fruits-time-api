import { Body, Controller, Post, Query } from '@nestjs/common';
import { AssistantService } from '@/core/assistant/assistant.service';
import { AskRequest } from '@/core/assistant/dto/ask-request.dto';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { Localized } from '@/shared/types/localized.type';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  private requireLoginText: Localized<string> = {
    uz: 'Chatdan foydalanish uchun tizimga kiring!',
    ru: 'Войдите в систему, чтобы использовать чат.',
    en: 'Log in to use chat!',
  };

  @Post('ask')
  @IsPublic()
  ask(@Query() query: BasicQuery, @RequestUser() user: ReqUser, @Body() body: AskRequest) {
    if (!user) {
      return {
        hasAnswer: false,
        text: this.requireLoginText[query.locale],
        suggestions: [],
      };
    }

    return this.assistantService.ask(query.locale, user.id, body.text);
  }
}
