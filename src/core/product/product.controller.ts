import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ProductService } from '@/core/product/product.service';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { CreateProductRequest } from '@/core/product/dto/create-product-request.dto';
import { uploadFileInterceptor } from '@/common/interceptors/upload-file.interceptor';
import { UpdateProductRequest } from '@/core/product/dto/update-product-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { SearchQuery } from '@/shared/dto/search-query.dto';

@Controller('catalog/:catalogId/product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @IsPublic()
  get(@Param('catalogId') catalogId: string, @Query() query: BasicQuery) {
    return this.productService.findAll(catalogId, query.locale);
  }

  @Get('search')
  @IsPublic()
  search(@Query() query: SearchQuery) {
    return this.productService.search(query.locale, query.search);
  }

  @Get('all')
  @Role(UserRole.ADMIN)
  getAll(@Param('catalogId') catalogId: string, @Query() query: BasicQuery) {
    return this.productService.findAll(catalogId, query.locale, false);
  }

  @Post()
  @Role(UserRole.ADMIN)
  @UseInterceptors(uploadFileInterceptor('product'))
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
  @UseInterceptors(uploadFileInterceptor('product'))
  async update(
    @Param('productId') productId: string,
    @Query() query: BasicQuery,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UpdateProductRequest,
  ) {
    await this.productService.update(productId, query.locale, file?.filename, body);

    return {
      message: 'Produkt yangilandi',
    };
  }

  @Delete(':productId')
  @Role(UserRole.ADMIN)
  async delete(@Param('productId') productId: string) {
    await this.productService.delete(productId);

    return {
      message: "Produkt o'chirildi",
    };
  }
}
