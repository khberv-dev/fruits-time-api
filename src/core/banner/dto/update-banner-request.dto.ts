import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateBannerRequest } from '@/core/banner/dto/create-banner-request.dto';

export class UpdateBannerRequest extends PartialType(CreateBannerRequest) {
  @ApiPropertyOptional({ example: true, description: 'Toggle banner visibility' })
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.value.toString() === 'true')
  isActive: boolean;
}
