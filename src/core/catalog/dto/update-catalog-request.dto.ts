import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCatalogRequest } from '@/core/catalog/dto/create-catalog-request.dto';

export class UpdateCatalogRequest extends PartialType(CreateCatalogRequest) {
  @ApiPropertyOptional({ example: true, description: 'Toggle catalog visibility' })
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.value.toString() === 'true')
  isActive: boolean;
}
