import { IsString } from 'class-validator';

export class VerifyOtpRequest {
  @IsString()
  sessionId: string;

  @IsString()
  code: string;
}
