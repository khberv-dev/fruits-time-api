import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { UserService } from '@/modules/app/user/user.service';
import { UpdateUserRequest } from '@/modules/app/user/dto/update-user-request.dto';

@Controller('app/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@Req() req: any) {
    return this.userService.getUserInfo(req.user.id);
  }
  @Put('profile')
  updateProfile(@Req() req: any, @Body() body: UpdateUserRequest) {
    return this.userService.updateUserInfo(req.user.id, body);
  }
}
