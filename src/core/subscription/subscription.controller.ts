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

const subscriptionExample = {
  id: 'c4d5e6f7-8901-2345-bcde-f12345678901',
  title: { uz: 'Kunlik sharbat obunasi' },
  productIds: ['b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b'],
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

const mySubscriptionExample = {
  subscriptions: [{ id: 'c4d5e6f7-8901-2345-bcde-f12345678901', title: 'Kunlik sharbat obunasi' }],
  products: [
    {
      id: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b',
      title: 'Apple Juice',
      price: 25000,
      freeUnitsPerDay: 1,
      remainingToday: 1,
    },
  ],
};

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List the caller's subscriptions and today's remaining free units",
    description:
      "Every product covered by one of the caller's active subscriptions, with `remainingToday` counting down as " +
      'free units are taken. Resets at midnight Asia/Tashkent. Empty arrays when the caller has no subscription.',
  })
  @ApiOkResponse({
    description: 'Active subscriptions and covered products',
    schema: { example: mySubscriptionExample },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMine(@RequestUser() user: ReqUser, @Query() query: BasicQuery) {
    return this.subscriptionService.getForUser(user.id, query.locale);
  }

  @Post('redeem')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Redeem a subscription code',
    description:
      'Binds the 36-character code to the caller, which is what grants the entitlement. Codes are single-use; ' +
      'redeeming a code the caller already holds succeeds again without consuming anything.',
  })
  @ApiOkResponse({ description: 'The subscription the code granted', schema: { example: subscriptionExample } })
  @ApiBadRequestResponse({ description: 'Code not found, malformed, or its subscription is inactive' })
  @ApiConflictResponse({ description: 'Code already redeemed by a different user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  redeem(@RequestUser() user: ReqUser, @Body() body: RedeemCodeRequest) {
    return this.subscriptionService.redeem(user.id, body.code);
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
      'The title is stored under the requested `locale`. Subscribers get one free unit of each listed product per day.',
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
      'Any subset of `title`/`productIds`/`isActive`. Deactivating withdraws the entitlement from every holder ' +
      'immediately without touching their codes, so reactivating restores it.',
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
