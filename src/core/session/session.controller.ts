import { Body, Controller, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SessionService } from '@/core/session/session.service';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { UpsertSessionRequest } from '@/core/session/dto/upsert-session-request.dto';

const sessionExample = { id: 'uuid', fcmToken: 'token', os: 'android', createdAt: '', updatedAt: '' };

@ApiTags('Session')
@ApiBearerAuth('access-token')
@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @ApiOperation({ summary: 'Create session for the current user (first launch)' })
  @ApiOkResponse({ schema: { example: sessionExample } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  create(@RequestUser() user: ReqUser, @Body() body: UpsertSessionRequest) {
    return this.sessionService.create(user.id, body);
  }

  @Patch()
  @ApiOperation({ summary: 'Update FCM token for the current user session' })
  @ApiOkResponse({ schema: { example: sessionExample } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'No session exists for this user' })
  update(@RequestUser() user: ReqUser, @Body() body: UpsertSessionRequest) {
    return this.sessionService.update(user.id, body);
  }
}
