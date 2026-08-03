import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { getStatusTiers, UserService } from '@/core/user/user.service';
import { OrderService } from '@/core/order/order.service';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { PaginationQuery } from '@/shared/dto/pagination-query.dto';
import { UpdateUserRequest } from '@/core/user/dto/update-user-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';

const userExample = {
  id: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e',
  firstName: 'Aziz',
  phoneNumber: '998901234567',
  birthday: '1995-08-15',
  weight: 72,
  height: 178,
  gender: 'male',
  referralCode: 'A2B7K9D',
  referralCount: 4,
  status: 'gold',
  discountPercent: 3,
  role: 'user',
  createdAt: '2025-01-15T08:23:11.512Z',
  updatedAt: '2025-02-02T10:11:00.000Z',
};

@ApiTags('User')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly orderService: OrderService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: "Get the authenticated user's profile" })
  @ApiOkResponse({ description: 'Current profile (password stripped)', schema: { example: userExample } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMe(@RequestUser() user: ReqUser) {
    return this.userService.findById(user.id);
  }

  @Get('status-tiers')
  @IsPublic()
  @ApiOperation({
    summary: 'List all referral status tiers and their discount percentages',
    description:
      'Static reference data (not tied to the caller): the referral count needed to reach each tier and the ' +
      'discount percentage it grants.',
  })
  @ApiOkResponse({
    description: 'All status tiers, ascending by referral threshold',
    schema: {
      example: [
        { status: 'silver', minReferrals: 0, discountPercent: 0 },
        { status: 'gold', minReferrals: 1, discountPercent: 3 },
        { status: 'vip', minReferrals: 6, discountPercent: 7 },
        { status: 'premium', minReferrals: 11, discountPercent: 12 },
      ],
    },
  })
  listStatusTiers() {
    return getStatusTiers();
  }

  @Get('me/referral')
  @ApiOperation({
    summary: "Get the authenticated user's referral code, invited-user count, status badge, and discount",
    description:
      'Returns the 7-character referral code (uppercase letters and digits), the number of accounts that registered using it, ' +
      'the current status badge derived from that count: `silver` (0, 0% discount), `gold` (1–5, 3%), `vip` (6–10, 7%), `premium` (≥ 11, 12%), ' +
      'plus the next tier with its discount and number of remaining referrals needed to reach it ' +
      '(`nextStatus`, `nextDiscountPercent` are `null` and `remaining` is `0` when already `premium`). ' +
      'A code is generated lazily on first call if the account does not have one yet.',
  })
  @ApiOkResponse({
    description: 'Referral code, invited-user count, status badge, and discount tiers',
    schema: {
      example: {
        code: 'A2B7K9D',
        count: 4,
        status: 'gold',
        discountPercent: 3,
        nextStatus: 'vip',
        nextDiscountPercent: 7,
        remaining: 2,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getReferral(@RequestUser() user: ReqUser) {
    return this.userService.getReferral(user.id);
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

  // Declared after every literal path ('me', 'status-tiers', 'me/referral') so the
  // parameterised routes below can't shadow them.
  @Get(':userId')
  @Role(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get one account by id (admin only)',
    description: 'Same shape as `/user/me`, including referral count, status tier and discount.',
  })
  @ApiParam({ name: 'userId', example: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e' })
  @ApiOkResponse({ description: 'The account (password stripped)', schema: { example: userExample } })
  @ApiNotFoundResponse({ description: 'No account with that id' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  getOne(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userService.findOneById(userId);
  }

  @Get(':userId/orders')
  @Role(UserRole.ADMIN)
  @ApiOperation({
    summary: "List one account's orders (admin only)",
    description: 'Paginated, newest first. Same envelope and order shape as `GET /order/admin`.',
  })
  @ApiParam({ name: 'userId', example: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e' })
  @ApiOkResponse({
    description: 'Paginated orders for that account',
    schema: { example: { data: [], total: 12, page: 1, pageSize: 20 } },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  getOrders(@Param('userId', ParseUUIDPipe) userId: string, @Query() query: PaginationQuery) {
    return this.orderService.listForUserPaginated(userId, query.page, query.pageSize, query.locale);
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
