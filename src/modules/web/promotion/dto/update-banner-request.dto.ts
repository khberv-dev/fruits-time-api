import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateBannerRequest {
  @IsOptional()
  @IsBoolean()
  isActive: boolean;
}
