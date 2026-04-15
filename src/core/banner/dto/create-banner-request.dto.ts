import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBannerRequest {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  file: any;
}
