import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogRequest } from '@/core/catalog/dto/create-catalog-request.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCatalogRequest extends PartialType(CreateCatalogRequest) {
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.value.toString() === 'true')
  isActive: boolean;
}
