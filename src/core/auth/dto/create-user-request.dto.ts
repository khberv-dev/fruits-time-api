import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    example: 'A2B7K9D',
    description: '7-character referral code from another user (uppercase letters and digits)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{7}$/, { message: "Referal kod 7 ta katta harf yoki raqamdan iborat bo'lishi kerak" })
  referralCode?: string;
}
