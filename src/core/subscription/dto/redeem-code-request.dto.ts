import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RedeemCodeRequest {
  @ApiProperty({
    example: '3f2a91c4-5b6e-4d3b-9c2a-1f2c8d3a4e5b',
    minLength: 36,
    maxLength: 36,
    description: 'The 36-character code an admin generated and handed out',
  })
  @IsString()
  @Length(36, 36)
  code: string;
}
