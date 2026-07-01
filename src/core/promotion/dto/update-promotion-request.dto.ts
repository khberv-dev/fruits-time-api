import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePromotionRequest {
  @ApiProperty({ example: true, description: 'Enable or disable the promotion' })
  @IsBoolean()
  isActive: boolean;
}
