import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserRequest {
  @ApiProperty({ example: 'Aziz', description: "User's first name" })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: '998901234567', description: '12-digit phone number, no leading + or spaces' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'Str0ngP@ss', description: 'Account password (stored as bcrypt hash)' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
