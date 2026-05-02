import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

export class PaginationQuery extends BasicQuery {
  @ApiProperty({ example: 1, minimum: 1, description: '1-indexed page number' })
  @Min(1)
  @IsInt()
  @Type(() => Number)
  page: number;

  @ApiProperty({ example: 20, maximum: 50, description: 'Page size (capped at 50)' })
  @Max(50)
  @IsInt()
  @Type(() => Number)
  pageSize: number;
}
