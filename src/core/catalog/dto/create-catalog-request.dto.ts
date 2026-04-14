import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCatalogRequest {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  file: any;
}
