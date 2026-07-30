import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionRequest {
  @ApiProperty({ example: 'Kunlik sharbat obunasi', description: 'Title, stored under the requested `locale`' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    type: [String],
    example: ['b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b'],
    description: 'Products a subscriber can take for free once per day. All ids must exist.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  productIds: string[];

  @ApiPropertyOptional({ example: true, default: true, description: 'Whether the subscription is live' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
