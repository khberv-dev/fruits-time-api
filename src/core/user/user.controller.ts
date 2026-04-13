import { Controller, Get } from '@nestjs/common';
import { UserService } from '@/core/user/user.service';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.types';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@RequestUser() user: ReqUser) {
    return this.userService.findById(user.id);
  }
}
