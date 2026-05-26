import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAddressRequest {
  @ApiProperty({ example: 'Uy', description: 'Label for the address' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 69.2401, description: 'Longitude' })
  @IsNumber()
  long: number;

  @ApiProperty({ example: 41.2995, description: 'Latitude' })
  @IsNumber()
  lat: number;
}
