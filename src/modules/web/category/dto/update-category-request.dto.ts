import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCategoryRequest {
  @IsOptional()
  @IsString()
  title: string;

  @IsOptional()
  @IsBoolean()
  isActive: boolean;
}
