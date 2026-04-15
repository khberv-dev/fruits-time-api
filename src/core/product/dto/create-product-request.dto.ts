import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
  file: any;
}
