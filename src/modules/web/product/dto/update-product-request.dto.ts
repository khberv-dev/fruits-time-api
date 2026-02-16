import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

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
}
