import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@/shared/enums/product-type.enum';

export class CreateCatalogRequest {
  @ApiProperty({ example: 'Juices', description: 'Catalog title in the locale specified by the `locale` query param' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ enum: ProductType, example: ProductType.JUICE, description: 'Defaults to `juice`' })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Catalog cover image (multipart upload)',
  })
  @IsOptional()
  file: any;
}
