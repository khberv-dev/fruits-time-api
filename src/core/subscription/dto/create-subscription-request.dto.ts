import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionRequest {
  @ApiProperty({ example: 'Kunlik sharbat obunasi', description: 'Title, stored under the requested `locale`' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    type: [String],
    example: ['b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b'],
    description: 'Products the daily discount can be spent against. All ids must exist.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  productIds: string[];

  @ApiProperty({
    example: 120,
    minimum: 0,
    description:
      'Sum a holder may knock off the listed products each day. Capped by what those lines cost — anything ' +
      'beyond it is paid normally, and it never spills onto products outside the list.',
  })
  @Min(0)
  @IsInt()
  @Type(() => Number)
  discountAmount: number;

  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    description:
      'How many days the entitlement lasts from the moment a code is redeemed. Omit for a subscription that ' +
      'never expires. Each code snapshots its own expiry when redeemed, so changing this later only affects ' +
      'codes redeemed afterwards.',
  })
  @IsOptional()
  @Min(1)
  @IsInt()
  @Type(() => Number)
  durationDays?: number;

  @ApiPropertyOptional({ example: true, default: true, description: 'Whether the subscription is live' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
