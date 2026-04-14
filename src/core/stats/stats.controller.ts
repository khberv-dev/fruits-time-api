import { Controller, Get } from '@nestjs/common';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { StatsService } from '@/core/stats/stats.service';

@Controller('stats')
@Role(UserRole.ADMIN)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getSummary() {
    return this.statsService.getSummary();
  }
}
