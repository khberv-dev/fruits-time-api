import { IsString, Length } from 'class-validator';

export class SendOtpRequest {
  @IsString()
  @Length(12, 12)
  phoneNumber: string;
}
