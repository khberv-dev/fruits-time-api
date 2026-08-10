import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQuery } from '@/shared/dto/pagination-query.dto';
import { SubscriptionRequestStatus } from '@/shared/enums/subscription-request-status.enum';

export class SubscriptionRequestQuery extends PaginationQuery {
  @ApiPropertyOptional({
    enum: SubscriptionRequestStatus,
    example: SubscriptionRequestStatus.NEW,
    description: 'Filter by status. Omit to list every request — pass `new` for the outstanding call list.',
  })
  @IsOptional()
  @IsEnum(SubscriptionRequestStatus)
  status?: SubscriptionRequestStatus;
}
