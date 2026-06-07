import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Os } from '@/shared/enums/os.enum';

export class UpsertSessionRequest {
  @ApiProperty({ example: 'dGhpcyBpcyBhIHRva2Vu...', description: 'Firebase Cloud Messaging token' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({ enum: Os, example: Os.ANDROID })
  @IsEnum(Os)
  os: Os;
}
