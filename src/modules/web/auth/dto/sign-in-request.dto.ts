import { IsString, Matches } from 'class-validator';
import { PHONE_NUMBER_PATTERN } from '@/shared/constants/pattern.constant';

export class SignInRequest {
  @Matches(PHONE_NUMBER_PATTERN)
  phoneNumber: string;

  @IsString()
  password: string;
}
