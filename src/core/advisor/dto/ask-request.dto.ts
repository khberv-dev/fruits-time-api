import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdvisorAskRequest {
  @ApiProperty({
    example: 'Which products generated the most revenue this month?',
    description: 'Business question about the app state or data.',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}
