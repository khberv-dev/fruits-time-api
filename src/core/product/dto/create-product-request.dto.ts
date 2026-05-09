import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@/shared/enums/product-type.enum';

export class CreateProductRequest {
  @ApiProperty({ example: 'Apple Juice', description: 'Title in the locale specified by the `locale` query param' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Cold-pressed apple juice with no added sugar.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    type: [String],
    example: ['vitamin C', 'potassium', 'fiber'],
    description: 'Compound list (sent as repeated form fields when multipart)',
  })
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  compound: string[];

  @ApiProperty({ example: 25000, minimum: 0, description: 'Price in minor units (UZS)' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ enum: ProductType, example: ProductType.JUICE })
  @IsOptional()
  @IsEnum(ProductType)
  type: ProductType;

  @ApiPropertyOptional({ example: 1024, description: 'External POS system product id' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  posId?: number;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Product image (multipart upload)',
  })
  @IsOptional()
  file: any;
}
