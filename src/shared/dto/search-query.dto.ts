import { IsString } from 'class-validator';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

export class SearchQuery extends BasicQuery {
  @IsString()
  search: string;
}
