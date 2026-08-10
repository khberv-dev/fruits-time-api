import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SubscriptionService } from '@/core/subscription/subscription.service';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { CreateSubscriptionRequest } from '@/core/subscription/dto/create-subscription-request.dto';
import { UpdateSubscriptionRequest } from '@/core/subscription/dto/update-subscription-request.dto';
import { GenerateCodesRequest } from '@/core/subscription/dto/generate-codes-request.dto';
import { RedeemCodeRequest } from '@/core/subscription/dto/redeem-code-request.dto';
import { UpdateRequestStatusRequest } from '@/core/subscription/dto/update-request-status.dto';
import { SubscriptionRequestQuery } from '@/core/subscription/dto/subscription-request-query.dto';

const subscriptionExample = {
  id: 'c4d5e6f7-8901-2345-bcde-f12345678901',
  title: { uz: 'Kunlik sharbat obunasi' },
  productIds: ['b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b'],
  discountAmount: 120,
  durationDays: 30,
  isActive: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const codeExample = {
  id: 'd5e6f7a8-9012-3456-cdef-123456789012',
  code: '3f2a91c4-5b6e-4d3b-9c2a-1f2c8d3a4e5b',
  redeemedAt: null,
  user: null,
  createdAt: '2026-07-01T00:00:00.000Z',
};

const codeViewExample = {
  code: '3f2a91c4-5b6e-4d3b-9c2a-1f2c8d3a4e5b',
  subscriptionId: 'c4d5e6f7-8901-2345-bcde-f12345678901',
  title: 'Kunlik sharbat obunasi',
  discountAmount: 120,
  isActive: true,
  status: 'available',
  durationDays: 30,
  expiresAt: null,
  products: [
    {
      id: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b',
      image: '6f1c2a8f-5b6e-4d3b-9c2a-1f2c8d3a4e5b.jpg',
      title: 'Apple Juice',
      description: 'Cold-pressed apple juice with no added sugar.',
      compound: ['vitamin C', 'potassium'],
      price: 25000,
      type: 'juice',
      isActive: true,
    },
  ],
};

const requestExample = {
  id: 'e6f7a8b9-0123-4567-def0-234567890123',
  status: 'new',
  createdAt: '2026-08-10T09:00:00.000Z',
  updatedAt: '2026-08-10T09:00:00.000Z',
};

const requestWithUserExample = {
  ...requestExample,
  user: {
    id: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e',
    firstName: 'Aziz',
    phoneNumber: '998901234567',
  },
};

const mySubscriptionExample = {
  subscriptions: [
    {
      id: 'c4d5e6f7-8901-2345-bcde-f12345678901',
      title: 'Kunlik sharbat obunasi',
      discountAmount: 120,
      durationDays: 30,
      expiresAt: '2026-09-02T09:00:00.000Z',
    },
  ],
  products: [{ id: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b', title: 'Apple Juice', price: 25000 }],
  dailyDiscountAmount: 120,
  remainingToday: 70,
};

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List the caller's subscriptions and today's remaining discount",
    description:
      "Every product the caller's daily allowance can be spent on, plus `dailyDiscountAmount` (the summed " +
      'allowance across their active subscriptions) and `remainingToday`, which counts down as orders consume it ' +
      'and resets at midnight Asia/Tashkent. Each subscription carries `expiresAt` (null = never expires) and the ' +
      '`durationDays` it was granted for. Expired subscriptions are dropped from the response entirely, so ' +
      'anything listed here is still valid. Zeroes and empty arrays when the caller has no active subscription.',
  })
  @ApiOkResponse({
    description: 'Active subscriptions, covered products, and the remaining daily allowance',
    schema: { example: mySubscriptionExample },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMine(@RequestUser() user: ReqUser, @Query() query: BasicQuery) {
    return this.subscriptionService.getForUser(user.id, query.locale);
  }

  @Get('code/:code')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Inspect a subscription code without redeeming it',
    description:
      'Shows what a code is worth before the caller commits to it: the covered products, the daily ' +
      '`discountAmount`, `durationDays`/`expiresAt`, and a `status` of `available` (free to redeem), ' +
      '`redeemed_by_you` (the caller already holds it), `redeemed` (claimed by someone else), `expired` (the ' +
      "caller's entitlement has run out), or `inactive` (its subscription is switched off). `expiresAt` is null " +
      'until the code is redeemed — the countdown starts then. Purely a lookup, nothing is consumed. Returns the ' +
      'same shape as `POST /subscription/redeem`.',
  })
  @ApiParam({ name: 'code', example: '3f2a91c4-5b6e-4d3b-9c2a-1f2c8d3a4e5b', description: '36-character code' })
  @ApiOkResponse({
    description: 'What the code grants and whether it can still be used',
    schema: { example: codeViewExample },
  })
  @ApiNotFoundResponse({ description: 'No such code' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  describeCode(@RequestUser() user: ReqUser, @Param('code') code: string, @Query() query: BasicQuery) {
    return this.subscriptionService.describeCode(user.id, code, query.locale);
  }

  @Post('redeem')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Redeem a subscription code',
    description:
      'Binds the 36-character code to the caller, which is what grants the entitlement. Codes are single-use; ' +
      'redeeming a code the caller already holds succeeds again without consuming anything. Returns the same ' +
      'shape as `GET /subscription/code/{code}`, with `status` set to `redeemed_by_you`.',
  })
  @ApiOkResponse({
    description: 'What the code granted',
    schema: { example: { ...codeViewExample, status: 'redeemed_by_you' } },
  })
  @ApiBadRequestResponse({ description: 'Code not found, malformed, or its subscription is inactive' })
  @ApiConflictResponse({ description: 'Code already redeemed by a different user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  redeem(@RequestUser() user: ReqUser, @Query() query: BasicQuery, @Body() body: RedeemCodeRequest) {
    return this.subscriptionService.redeem(user.id, body.code, query.locale);
  }

  @Post('request')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Ask to be signed up for a subscription',
    description:
      'Records the caller on the admin call list. Grants nothing on its own — an admin still has to contact ' +
      'them and hand over a code. Calling this again while a `new` request is outstanding returns that same ' +
      'request instead of queueing a duplicate.',
  })
  @ApiCreatedResponse({ description: 'The outstanding request', schema: { example: requestExample } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  createRequest(@RequestUser() user: ReqUser) {
    return this.subscriptionService.createRequest(user.id);
  }

  @Get('request')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List subscription requests (admin only)',
    description:
      'Paginated, **oldest first** — this is a queue of customers waiting to be called. Pass `status=new` for ' +
      'the outstanding ones. Each row carries the phone number to call.',
  })
  @ApiOkResponse({
    description: 'Paginated requests',
    schema: { example: { data: [requestWithUserExample], total: 12, page: 1, pageSize: 20 } },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  listRequests(@Query() query: SubscriptionRequestQuery) {
    return this.subscriptionService.listRequests(query.page, query.pageSize, query.status);
  }

  @Patch('request/:id')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Set a request status (admin only)',
    description:
      'Marks whether the customer has been contacted. `accepted` is bookkeeping only: it creates no ' +
      'subscription and hands out no code, so the entitlement still has to be granted by generating one.',
  })
  @ApiParam({ name: 'id', example: 'e6f7a8b9-0123-4567-def0-234567890123' })
  @ApiOkResponse({ description: 'Updated request', schema: { example: { ...requestExample, status: 'accepted' } } })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  updateRequestStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateRequestStatusRequest) {
    return this.subscriptionService.updateRequestStatus(id, body.status);
  }

  @Get()
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all subscriptions (admin only)' })
  @ApiOkResponse({ description: 'All subscriptions, newest first', schema: { example: [subscriptionExample] } })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  list() {
    return this.subscriptionService.findAll();
  }

  @Post()
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a subscription (admin only)',
    description:
      'The title is stored under the requested `locale`. Holders get `discountAmount` off the listed products ' +
      'once per day, pooled across those lines — e.g. with a 120 allowance, a cart of 200 in listed products ' +
      'plus 80 in others totals 160, the customer paying the 80 overflow on the listed ones.',
  })
  @ApiCreatedResponse({ description: 'Created subscription', schema: { example: subscriptionExample } })
  @ApiBadRequestResponse({ description: 'One or more productIds do not exist' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  create(@Query() query: BasicQuery, @Body() body: CreateSubscriptionRequest) {
    return this.subscriptionService.create(query.locale, body);
  }

  @Patch(':id')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Edit, activate, or deactivate a subscription (admin only)',
    description:
      'Any subset of `title`/`productIds`/`discountAmount`/`isActive`. Deactivating withdraws the entitlement ' +
      'from every holder immediately without touching their codes, so reactivating restores it.',
  })
  @ApiParam({ name: 'id', example: 'c4d5e6f7-8901-2345-bcde-f12345678901' })
  @ApiOkResponse({ description: 'Updated subscription', schema: { example: subscriptionExample } })
  @ApiBadRequestResponse({ description: 'One or more productIds do not exist' })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  update(@Param('id', ParseUUIDPipe) id: string, @Query() query: BasicQuery, @Body() body: UpdateSubscriptionRequest) {
    return this.subscriptionService.update(id, query.locale, body);
  }

  @Post(':id/codes')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generate single-use codes for a subscription (admin only)',
    description: 'Returns the generated codes so they can be handed out. Each is a 36-character UUID.',
  })
  @ApiParam({ name: 'id', example: 'c4d5e6f7-8901-2345-bcde-f12345678901' })
  @ApiCreatedResponse({ description: 'Generated codes', schema: { example: [codeExample] } })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  generateCodes(@Param('id', ParseUUIDPipe) id: string, @Body() body: GenerateCodesRequest) {
    return this.subscriptionService.generateCodes(id, body.count);
  }

  @Get(':id/codes')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List a subscription's codes and who redeemed them (admin only)",
    description: 'Includes the redeeming user when the code has been claimed, so admins can see which codes are spent.',
  })
  @ApiParam({ name: 'id', example: 'c4d5e6f7-8901-2345-bcde-f12345678901' })
  @ApiOkResponse({ description: 'Codes, newest first', schema: { example: [codeExample] } })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  listCodes(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionService.listCodes(id);
  }
}
