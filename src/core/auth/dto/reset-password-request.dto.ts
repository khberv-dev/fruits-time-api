import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordRequest {
  @ApiProperty({ example: 'Str0ngP@ss', description: 'New account password (stored as bcrypt hash)' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
