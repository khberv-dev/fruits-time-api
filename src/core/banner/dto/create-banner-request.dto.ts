import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBannerRequest {
  @ApiProperty({
    example: 'Summer sale',
    description: 'Banner title in the locale specified by the `locale` query param',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Up to 30% off all juices through July.', description: 'Banner body copy' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Banner image (multipart upload)',
  })
  @IsOptional()
  file: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Banner thumbnail (multipart upload)',
  })
  @IsOptional()
  thumbnail: any;

  @ApiPropertyOptional({ example: false, description: 'Show this banner as a popup. Defaults to false' })
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.value.toString() === 'true')
  popup?: boolean;
}
