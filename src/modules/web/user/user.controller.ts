import { Controller, Get, Req } from '@nestjs/common';
import { UserService } from '@/modules/web/user/user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@Req() req: any) {
    return this.userService.getUserInfo(req.user.id);
  }
}
