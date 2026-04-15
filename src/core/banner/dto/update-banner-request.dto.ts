import { PartialType } from '@nestjs/mapped-types';
import { CreateBannerRequest } from '@/core/banner/dto/create-banner-request.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateBannerRequest extends PartialType(CreateBannerRequest) {
  @IsOptional()
  @IsBoolean()
  isActive: boolean;
}
