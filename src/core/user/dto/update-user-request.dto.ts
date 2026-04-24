import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Gender } from '@/shared/enums/gender.enum';

export class UpdateUserRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  birthday: string;

  @IsOptional()
  @IsInt()
  weight: number;

  @IsOptional()
  @IsInt()
  height: number;

  @IsOptional()
  @IsEnum(Gender)
  gender: Gender;
}
