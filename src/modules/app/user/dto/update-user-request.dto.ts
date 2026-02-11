import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { PHONE_NUMBER_PATTERN } from '@/shared/constants/pattern.constant';

export class UpdateUserRequest {
  @IsOptional()
  @IsString()
  @Length(2, 20)
  firstName: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  lastName: string;

  @IsOptional()
  @Matches(PHONE_NUMBER_PATTERN)
  phoneNumber: string;
}
