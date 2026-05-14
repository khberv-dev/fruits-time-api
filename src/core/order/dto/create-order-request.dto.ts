import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
