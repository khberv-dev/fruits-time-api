import { Controller, Get } from '@nestjs/common';
import { IsPublic } from '@/common/decorators/is_public.decorator';

@Controller()
@IsPublic()
export class AppController {
  @Get()
  getStatus() {
    return {
      ok: true,
    };
  }
}
