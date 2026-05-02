import { IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DateRangeQuery {
  @ApiProperty({ example: '2025-01-01', description: 'Inclusive start date (ISO-8601, date or datetime)' })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({ example: '2025-01-31', description: 'Inclusive end date (ISO-8601, date or datetime)' })
  @IsDate()
  @Type(() => Date)
  endDate: Date;
}
