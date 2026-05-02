import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { StatsService } from '@/core/stats/stats.service';
import { DateRangeQuery } from '@/shared/dto/date-range-query.dto';

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
