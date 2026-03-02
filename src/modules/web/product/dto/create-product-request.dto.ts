import { IsEnum, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '@/shared/enums/product-type.enum';

export class CreateProductRequest {
  @IsString()
  title: string;

  @IsString()
  categoryId: string;

  @IsEnum(ProductType)
  type: ProductType;

  @IsInt()
  @Type(() => Number)
  price: number;
}
