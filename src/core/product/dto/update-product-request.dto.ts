import { PartialType } from '@nestjs/mapped-types';
import { CreateProductRequest } from '@/core/product/dto/create-product-request.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProductRequest extends PartialType(CreateProductRequest) {
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.value.toString() === 'true')
  isActive: boolean;
}
