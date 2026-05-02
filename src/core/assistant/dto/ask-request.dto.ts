import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskRequest {
  @ApiProperty({
    example: 'Which juice would you recommend after a workout?',
    description: 'Free-form question. The assistant answers in the same language as the question.',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}
