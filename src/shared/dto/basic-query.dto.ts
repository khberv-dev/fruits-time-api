import { IsEnum, IsNotEmpty } from 'class-validator';
import { Locale } from '@/shared/enums/locale.enum';

export class BasicQuery {
  @IsEnum(Locale)
  @IsNotEmpty()
  locale: Locale;
}
