import { PartialType } from '@nestjs/mapped-types';
import { CreateBannerRequest } from '@/core/banner/dto/create-banner-request.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateBannerRequest extends PartialType(CreateBannerRequest) {
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.value.toString() === 'true')
  isActive: boolean;
}
