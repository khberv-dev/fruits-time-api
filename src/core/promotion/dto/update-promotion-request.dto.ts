import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePromotionRequest {
  @ApiProperty({ example: true, description: 'Enable or disable the promotion' })
  @IsBoolean()
  isActive: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b'],
    description:
      'Product UUIDs this promotion applies to. Only meaningful for promotions scoped to specific products ' +
      '(e.g. buy-two-get-one-free); ignored otherwise.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];
}
