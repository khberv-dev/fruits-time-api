import { IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductRequest {
  @IsString()
  title: string;

  @IsString()
  categoryId: string;

  @IsInt()
  @Type(() => Number)
  price: number;
}
