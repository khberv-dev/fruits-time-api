import { IsString } from 'class-validator';

export class VerifyOtpRequest {
  @IsString()
  code: string;
}
