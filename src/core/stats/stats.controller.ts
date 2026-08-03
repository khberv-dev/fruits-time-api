import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { StatsService } from '@/core/stats/stats.service';
import { DateRangeQuery } from '@/shared/dto/date-range-query.dto';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

@ApiTags('Stats')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin' })
@Controller('stats')
@Role(UserRole.ADMIN)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard summary counts (admin only)' })
  @ApiOkResponse({
    description: 'Total counts across the catalog',
    schema: {
      example: {
        usersCount: 134,
        catalogsCount: 8,
        productsCount: 96,
        ordersCount: 412,
      },
    },
  })
  getSummary() {
    return this.statsService.getSummary();
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Latest 10 users, orders, and subscription activations (admin only)',
    description:
      'Dashboard "recent activity" feed. Each list is capped at 10 and ordered newest first. Subscription ' +
      'activations come from redeemed codes and only include subscriptions that are still active. Order `total` ' +
      'is the discounted product total; delivery is reported separately as `deliveryCost`.',
  })
  @ApiOkResponse({
    description: 'Recent users, orders, and subscription activations',
    schema: {
      example: {
        users: [
          {
            id: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e',
            firstName: 'Aziz',
            phoneNumber: '998901234567',
            createdAt: '2026-08-01T08:23:11.512Z',
          },
        ],
        orders: [
          {
            id: '7e9f2d3b-1234-4abc-9d8e-2c4f6a1b3c5d',
            posId: 45,
            status: 'created',
            type: 'delivery',
            total: 91000,
            deliveryCost: 12000,
            branch: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Chilonzor' },
            user: {
              id: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e',
              firstName: 'Aziz',
              phoneNumber: '998901234567',
              createdAt: '2026-08-01T08:23:11.512Z',
            },
            createdAt: '2026-08-02T10:15:00.000Z',
          },
        ],
        subscriptions: [
          {
            codeId: 'd5e6f7a8-9012-3456-cdef-123456789012',
            code: '3f2a91c4-5b6e-4d3b-9c2a-1f2c8d3a4e5b',
            redeemedAt: '2026-08-02T09:00:00.000Z',
            user: {
              id: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e',
              firstName: 'Aziz',
              phoneNumber: '998901234567',
              createdAt: '2026-08-01T08:23:11.512Z',
            },
            subscription: {
              id: 'c4d5e6f7-8901-2345-bcde-f12345678901',
              title: 'Kunlik sharbat obunasi',
              discountAmount: 120,
            },
          },
        ],
      },
    },
  })
  getRecent(@Query() query: BasicQuery) {
    return this.statsService.getRecent(query.locale);
  }

  @Get('users-trend')
  @ApiOperation({
    summary: 'New-users-per-day trend over a date range (admin only)',
    description: 'Returns one row per day in `[startDate, endDate]`, with zeros for empty days.',
  })
  @ApiOkResponse({
    description: 'Daily new-user counts',
    schema: {
      example: [
        { date: '2025-01-01', count: 3 },
        { date: '2025-01-02', count: 0 },
        { date: '2025-01-03', count: 5 },
      ],
    },
  })
  getUsersTrend(@Query() query: DateRangeQuery) {
    return this.statsService.getUsersTrend(query.startDate, query.endDate);
  }

  @Get('orders-trend')
  @ApiOperation({
    summary: 'Orders-per-day trend over a date range (admin only)',
    description: 'Returns one row per day in `[startDate, endDate]`, with zeros for empty days.',
  })
  @ApiOkResponse({
    description: 'Daily order counts',
    schema: {
      example: [
        { date: '2025-01-01', count: 12 },
        { date: '2025-01-02', count: 8 },
        { date: '2025-01-03', count: 17 },
      ],
    },
  })
  getOrdersTrend(@Query() query: DateRangeQuery) {
    return this.statsService.getOrdersTrend(query.startDate, query.endDate);
  }
}
