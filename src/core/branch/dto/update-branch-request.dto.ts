import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches } from 'class-validator';
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

  @ApiPropertyOptional({ example: 1, description: 'POS storage ID linked to this branch' })
  @IsOptional()
  @IsInt()
  storageId?: number;

  @ApiPropertyOptional({ example: 'Jasur', description: 'Branch manager name (used as delivery origin contact)' })
  @IsOptional()
  @IsString()
  managerName?: string;

  @ApiPropertyOptional({
    example: '+998901234567',
    description: 'Branch manager phone (used as delivery origin contact)',
  })
  @IsOptional()
  @IsString()
  managerPhone?: string;

  @ApiPropertyOptional({ example: '09:00', description: 'Opening time in HH:mm format' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'openTime must be in HH:mm format' })
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00', description: 'Closing time in HH:mm format' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closeTime must be in HH:mm format' })
  closeTime?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the branch is currently accepting orders' })
  @IsOptional()
  @IsBoolean()
  isWorking?: boolean;
}
