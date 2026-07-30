import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateCodesRequest {
  @ApiProperty({ example: 10, minimum: 1, maximum: 500, description: 'How many single-use codes to generate' })
  @Min(1)
  @Max(500)
  @IsInt()
  @Type(() => Number)
  count: number;
}
