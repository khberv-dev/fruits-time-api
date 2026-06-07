import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SessionService } from '@/core/session/session.service';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { UpsertSessionRequest } from '@/core/session/dto/upsert-session-request.dto';

@ApiTags('Session')
@ApiBearerAuth('access-token')
@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update the current user session (FCM token + OS)' })
  @ApiOkResponse({ schema: { example: { id: 'uuid', fcmToken: 'token', os: 'android', createdAt: '', updatedAt: '' } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  upsert(@RequestUser() user: ReqUser, @Body() body: UpsertSessionRequest) {
    return this.sessionService.upsert(user.id, body);
  }
}
