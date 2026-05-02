import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpRequest {
  @ApiProperty({ example: '998901234567', description: 'Exactly 12 digits, country code first' })
  @IsString()
  @Length(12, 12)
  phoneNumber: string;
}
