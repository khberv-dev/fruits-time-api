import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

export class PaginatedSearchQuery extends BasicQuery {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1, description: '1-indexed page number' })
  @IsOptional()
  @Min(1)
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50, default: 20, description: 'Page size (capped at 50)' })
  @IsOptional()
  @Min(1)
  @Max(50)
  @IsInt()
  @Type(() => Number)
  pageSize: number = 20;

  @ApiPropertyOptional({
    example: 'apple',
    description: 'Optional search term matched against title (and compound, for products). Omit to list all.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
