import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProductRequest } from '@/core/product/dto/create-product-request.dto';

export class UpdateProductRequest extends PartialType(CreateProductRequest) {
  @ApiPropertyOptional({ example: true, description: 'Toggle product visibility' })
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.value.toString() === 'true')
  isActive: boolean;
}
