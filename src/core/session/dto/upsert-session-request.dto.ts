import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Os } from '@/shared/enums/os.enum';
import { Locale } from '@/shared/enums/locale.enum';

export class UpsertSessionRequest {
  @ApiProperty({ example: 'dGhpcyBpcyBhIHRva2Vu...', description: 'Firebase Cloud Messaging token' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({ enum: Os, example: Os.ANDROID })
  @IsEnum(Os)
  os: Os;

  @ApiPropertyOptional({ enum: Locale, example: Locale.uz, default: Locale.uz })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}
