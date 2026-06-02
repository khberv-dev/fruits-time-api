import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

export class DeliveryCostQuery extends BasicQuery {
  @ApiProperty({ example: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b', description: 'Branch (origin) ID' })
  @IsUUID()
  branchId: string;

  @ApiProperty({
    example: 'c2e5ff3d-3f1b-5a23-9b9c-4b5e6f7a8c9d',
    description: "User's saved address (destination) ID",
  })
  @IsUUID()
  addressId: string;
}
