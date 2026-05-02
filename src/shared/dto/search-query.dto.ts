import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

export class SearchQuery extends BasicQuery {
  @ApiProperty({ example: 'apple', description: 'Search term — matched against title and compound entries' })
  @IsString()
  search: string;
}
