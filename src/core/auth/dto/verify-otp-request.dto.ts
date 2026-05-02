import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpRequest {
  @ApiProperty({ example: '12345', description: '5-digit code received by SMS' })
  @IsString()
  code: string;
}
