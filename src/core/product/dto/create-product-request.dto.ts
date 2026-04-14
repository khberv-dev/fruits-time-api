import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  file: any;
}
