import { IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterUserRequest {
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  otpSession: string;
}
