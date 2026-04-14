import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

export class PaginationQuery extends BasicQuery {
  @Min(1)
  @IsInt()
  @Type(() => Number)
  page: number;

  @Max(50)
  @IsInt()
  @Type(() => Number)
  pageSize: number;
}
