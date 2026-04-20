import { Body, Controller, Post, Query } from '@nestjs/common';
import { AssistantService } from '@/core/assistant/assistant.service';
import { AskRequest } from '@/core/assistant/dto/ask-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('ask')
  @IsPublic()
  ask(@Query() query: BasicQuery, @Body() body: AskRequest) {
    return this.assistantService.ask(query.locale, body.text);
  }
}
