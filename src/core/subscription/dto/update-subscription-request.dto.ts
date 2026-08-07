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
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSubscriptionRequest {
  @ApiPropertyOptional({
    example: 'Kunlik sharbat obunasi',
    description: 'Replaces the title for the requested `locale` only, leaving other locales intact',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b'],
    description: 'Replaces the covered product list wholesale. All ids must exist.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    example: 120,
    minimum: 0,
    description: 'Sum a holder may knock off the listed products each day. Takes effect from the next order.',
  })
  @IsOptional()
  @Min(0)
  @IsInt()
  @Type(() => Number)
  discountAmount?: number;

  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    description:
      'Days the entitlement lasts from redemption. Only applies to codes redeemed after this change — existing ' +
      'holders keep the expiry snapshotted when they redeemed. There is no never-expires option; every ' +
      'activation is dated, defaulting to 30 days.',
  })
  @IsOptional()
  @Min(1)
  @IsInt()
  @Type(() => Number)
  durationDays?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Activate or deactivate. Deactivating stops the entitlement for every holder at once.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
