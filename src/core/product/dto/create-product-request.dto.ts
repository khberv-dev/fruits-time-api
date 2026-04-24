import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '@/shared/enums/product-type.enum';

export class CreateProductRequest {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  compound: string[];

  @IsInt()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsEnum(ProductType)
  type: ProductType;

  @IsOptional()
  file: any;
}
