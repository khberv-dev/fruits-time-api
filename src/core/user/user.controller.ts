import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { UserService } from '@/core/user/user.service';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { PaginationQuery } from '@/shared/dto/pagination-query.dto';
import { UpdateUserRequest } from '@/core/user/dto/update-user-request.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@RequestUser() user: ReqUser) {
    return this.userService.findById(user.id);
  }

  @Get()
  @Role(UserRole.ADMIN)
  getAll(@Query() query: PaginationQuery) {
    return this.userService.findAllPaginate(query.page, query.pageSize);
  }

  @Put('me')
  async updateMe(@RequestUser() user: ReqUser, @Body() body: UpdateUserRequest) {
    await this.userService.update(user.id, body);

    return {
      message: 'Profil yangilandi',
    };
  }
}
