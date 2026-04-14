import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { StatsService } from '@/core/stats/stats.service';
import { DateRangeQuery } from '@/shared/dto/date-range-query.dto';

@Controller('stats')
@Role(UserRole.ADMIN)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getSummary() {
    return this.statsService.getSummary();
  }

  @Get('users-trend')
  getUsersTrend(@Query() query: DateRangeQuery) {
    return this.statsService.getUsersTrend(query.startDate, query.endDate);
  }

  @Get('orders-trend')
  getOrdersTrend(@Query() query: DateRangeQuery) {
    return this.statsService.getOrdersTrend(query.startDate, query.endDate);
  }
}
