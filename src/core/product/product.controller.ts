import { Body, Controller, Get, Param, Post, Put, Query, UploadedFile } from '@nestjs/common';
import { ProductService } from '@/core/product/product.service';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { CreateProductRequest } from '@/core/product/dto/create-product-request.dto';

@Controller(':catalogId/product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  get(@Param('catalogId') catalogId: string, @Query() query: BasicQuery) {
    return this.productService.findAll(catalogId, query.locale);
  }

  @Get('all')
  @Role(UserRole.ADMIN)
  getAll(@Param('catalogId') catalogId: string, @Query() query: BasicQuery) {
    return this.productService.findAll(catalogId, query.locale, false);
  }

  @Post()
  @Role(UserRole.ADMIN)
  async create(
    @Param('catalogId') catalogId: string,
    @Query() query: BasicQuery,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateProductRequest,
  ) {
    await this.productService.create(catalogId, query.locale, file.filename, body);

    return {
      message: 'Produkt yaratildi',
    };
  }

  @Put(':productId')
  @Role(UserRole.ADMIN)
  async update(
    @Param('productId') productId: string,
    @Query() query: BasicQuery,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateProductRequest,
  ) {
    await this.productService.update(productId, query.locale, file.filename, body);

    return {
      message: 'Produkt yaratildi',
    };
  }
}
