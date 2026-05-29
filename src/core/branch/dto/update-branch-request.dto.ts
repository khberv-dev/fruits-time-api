import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBranchRequest {
  @ApiPropertyOptional({ example: 69.2401, description: 'Longitude' })
  @IsOptional()
  @IsNumber()
  long?: number;

  @ApiPropertyOptional({ example: 41.2995, description: 'Latitude' })
  @IsOptional()
  @IsNumber()
  lat?: number;
}
