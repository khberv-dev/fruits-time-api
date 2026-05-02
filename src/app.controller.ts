import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsPublic } from '@/common/decorators/is_public.decorator';

@ApiTags('Health')
@Controller()
@IsPublic()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  getStatus() {
    return {
      ok: true,
    };
  }
}
