import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AssistantService } from '@/core/assistant/assistant.service';
import { AskRequest } from '@/core/assistant/dto/ask-request.dto';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { Localized } from '@/shared/types/localized.type';

const productSuggestionExample = {
  id: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b',
  image: '6f1c2a8f-5b6e-4d3b-9c2a-1f2c8d3a4e5b.jpg',
  title: 'Apple Juice',
  description: 'Cold-pressed apple juice with no added sugar.',
  compound: ['vitamin C', 'potassium', 'fiber'],
  price: 25000,
  type: 'juice',
  isActive: true,
  createdAt: '2025-01-12T08:00:00.000Z',
  updatedAt: '2025-01-12T08:00:00.000Z',
};

@ApiTags('Assistant')
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
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Ask the AI nutritionist a question',
    description:
      'When called without a valid access token, returns a localized "log in" message instead of calling the model. ' +
      'When authenticated, conversation history within the previous hour is replayed as context.',
  })
  @ApiOkResponse({
    description: 'Authenticated response',
    schema: {
      examples: {
        authenticated: {
          summary: 'Authenticated reply',
          value: {
            text: 'After a workout, an apple juice helps replenish potassium and offers quick carbohydrates for recovery.',
            suggestions: [productSuggestionExample],
          },
        },
        unauthenticated: {
          summary: 'No access token (or expired)',
          value: {
            hasAnswer: false,
            text: 'Log in to use chat!',
            suggestions: [],
          },
        },
      },
    },
  })
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

  @Get('history')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Replay the authenticated user's current chat session",
    description:
      'Returns messages from the current session (defined as the contiguous tail with no >1h gap between messages). ' +
      'Empty array if the latest message is older than 1 hour.',
  })
  @ApiOkResponse({
    description: 'Chronological list of messages',
    schema: {
      example: [
        {
          id: 'f1e2d3c4-b5a6-7890-abcd-ef1234567890',
          role: 'user',
          text: 'Which juice would you recommend after a workout?',
          createdAt: '2025-05-01T09:00:00.000Z',
        },
        {
          id: '01928374-65ab-cdef-0123-456789abcdef',
          role: 'model',
          text: 'After a workout, an apple juice helps replenish potassium and offers quick carbohydrates for recovery.',
          suggestions: [productSuggestionExample],
          createdAt: '2025-05-01T09:00:02.000Z',
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  history(@Query() query: BasicQuery, @RequestUser() user: ReqUser) {
    return this.assistantService.history(query.locale, user.id);
  }
}
