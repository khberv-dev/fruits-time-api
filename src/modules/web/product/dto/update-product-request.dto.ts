import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '@/shared/enums/product-type.enum';

export class UpdateProductRequest {
  @IsOptional()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  categoryId: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive: boolean;

  @IsOptional()
  @IsEnum(ProductType)
  type: ProductType;
}
