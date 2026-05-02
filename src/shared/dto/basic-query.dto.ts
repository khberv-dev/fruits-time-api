import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@/shared/enums/locale.enum';

export class BasicQuery {
  @ApiProperty({ enum: Locale, example: Locale.uz, description: 'Locale used to read/write localized fields' })
  @IsEnum(Locale)
  @IsNotEmpty()
  locale: Locale;
}
