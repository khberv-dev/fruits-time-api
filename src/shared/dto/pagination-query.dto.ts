import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

export class PaginationQuery extends BasicQuery {
  @IsInt()
  @Type(() => Number)
  page: number;

  @IsInt()
  @Type(() => Number)
  pageSize: number;
}
