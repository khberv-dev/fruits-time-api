import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCatalogRequest {
  @ApiProperty({ example: 'Juices', description: 'Catalog title in the locale specified by the `locale` query param' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Catalog cover image (multipart upload)',
  })
  @IsOptional()
  file: any;
}
