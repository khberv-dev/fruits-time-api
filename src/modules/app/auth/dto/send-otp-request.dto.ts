import { Matches } from 'class-validator';
import { PHONE_NUMBER_PATTERN } from '../../../../shared/constants/pattern.constant';

export class SendOtpRequest {
  @Matches(PHONE_NUMBER_PATTERN)
  phoneNumber: string;
}
