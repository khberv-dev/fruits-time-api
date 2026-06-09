import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@/shared/enums/locale.enum';

export class BasicQuery {
  @ApiPropertyOptional({
    enum: Locale,
    example: Locale.uz,
    default: Locale.uz,
    description: 'Locale used to read/write localized fields',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale: Locale = Locale.uz;
}
