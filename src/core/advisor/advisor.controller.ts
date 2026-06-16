import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdvisorService } from '@/core/advisor/advisor.service';
import { AdvisorAskRequest } from '@/core/advisor/dto/ask-request.dto';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';

@ApiTags('Advisor')
@ApiBearerAuth('access-token')
@Role(UserRole.ADMIN)
@Controller('advisor')
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Ask the AI business advisor a question',
    description:
      'Gathers a real-time snapshot of all business data (orders, users, products, branches, revenue) ' +
      'and answers the question in the context of that data. Admin only.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        hasAnswer: true,
        text: 'The top product this month is Mango Boost with 142 orders.',
      },
    },
  })
  ask(@RequestUser() user: ReqUser, @Body() body: AdvisorAskRequest) {
    return this.advisorService.ask(user.id, body.text);
  }

  @Get('history')
  @ApiOperation({
    summary: "Replay the admin's full advisor conversation history",
  })
  @ApiOkResponse({
    schema: {
      example: [
        { id: 'uuid', role: 'user', text: 'Which product sold the most?', createdAt: '2026-06-16T10:00:00.000Z' },
        {
          id: 'uuid',
          role: 'model',
          hasAnswer: true,
          text: 'Mango Boost leads with 142 orders.',
          createdAt: '2026-06-16T10:00:02.000Z',
        },
      ],
    },
  })
  history(@RequestUser() user: ReqUser) {
    return this.advisorService.history(user.id);
  }
}
