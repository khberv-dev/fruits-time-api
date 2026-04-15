import { Body, Controller, Post } from '@nestjs/common';
import { AssistantService } from '@/core/assistant/assistant.service';
import { AskRequest } from '@/core/assistant/dto/ask-request.dto';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('ask')
  ask(@Body() body: AskRequest) {
    return this.assistantService.startChat(body.text);
  }
}
