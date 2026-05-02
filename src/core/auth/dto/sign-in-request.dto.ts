import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignInRequest {
  @ApiProperty({ example: '998901234567', description: '12-digit phone number registered on the account' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'Str0ngP@ss' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
