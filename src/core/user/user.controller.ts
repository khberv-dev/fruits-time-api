import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserService } from '@/core/user/user.service';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { PaginationQuery } from '@/shared/dto/pagination-query.dto';
import { UpdateUserRequest } from '@/core/user/dto/update-user-request.dto';

const userExample = {
  id: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e',
  firstName: 'Aziz',
  phoneNumber: '998901234567',
  birthday: '1995-08-15',
  weight: 72,
  height: 178,
  gender: 'male',
  role: 'user',
  createdAt: '2025-01-15T08:23:11.512Z',
  updatedAt: '2025-02-02T10:11:00.000Z',
};

@ApiTags('User')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: "Get the authenticated user's profile" })
  @ApiOkResponse({ description: 'Current profile (password stripped)', schema: { example: userExample } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMe(@RequestUser() user: ReqUser) {
    return this.userService.findById(user.id);
  }

  @Get()
  @Role(UserRole.ADMIN)
  @ApiOperation({ summary: 'List end-users (admin only)', description: 'Paginated list of accounts with role=user.' })
  @ApiOkResponse({
    description: 'Paginated users',
    schema: {
      example: {
        users: [userExample],
        total: 134,
        pages: 7,
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  getAll(@Query() query: PaginationQuery) {
    return this.userService.findAllPaginate(query.page, query.pageSize);
  }

  @Put('me')
  @ApiOperation({ summary: "Update the authenticated user's profile" })
  @ApiOkResponse({ schema: { example: { message: 'Profil yangilandi' } } })
  async updateMe(@RequestUser() user: ReqUser, @Body() body: UpdateUserRequest) {
    await this.userService.update(user.id, body);

    return {
      message: 'Profil yangilandi',
    };
  }
}
