import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '@/shared/enums/order-type.enum';

export class CreateOrderItem {
  @ApiProperty({ example: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b', description: 'Product UUID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderRequest {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Branch UUID' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ enum: OrderType, example: OrderType.PICKUP, description: 'How the order is fulfilled' })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      "UUID of one of the caller's saved addresses. Its coordinates are snapshotted onto the order. Omit for pickup orders.",
  })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiProperty({
    type: [CreateOrderItem],
    description: 'Products in the order with their quantities. At least one item is required.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItem)
  items: CreateOrderItem[];
}
