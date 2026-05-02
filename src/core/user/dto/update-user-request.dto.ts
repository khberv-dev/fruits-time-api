import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@/shared/enums/gender.enum';

export class UpdateUserRequest {
  @ApiPropertyOptional({ example: '15-08-1995', description: 'Birthday in DD-MM-YYYY format' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  birthday: string;

  @ApiPropertyOptional({ example: 72, description: 'Weight in kilograms' })
  @IsOptional()
  @IsInt()
  weight: number;

  @ApiPropertyOptional({ example: 178, description: 'Height in centimeters' })
  @IsOptional()
  @IsInt()
  height: number;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
  @IsOptional()
  @IsEnum(Gender)
  gender: Gender;
}
