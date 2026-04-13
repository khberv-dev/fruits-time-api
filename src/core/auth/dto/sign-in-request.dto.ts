import { IsNotEmpty, IsString } from 'class-validator';

export class SignInRequest {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
