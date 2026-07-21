import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProductService } from '@/core/product/product.service';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { CreateProductRequest } from '@/core/product/dto/create-product-request.dto';
import { uploadFileInterceptor } from '@/common/interceptors/upload-file.interceptor';
import { UpdateProductRequest } from '@/core/product/dto/update-product-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { SearchQuery } from '@/shared/dto/search-query.dto';
import { PaginatedSearchQuery } from '@/shared/dto/paginated-search-query.dto';

const productExample = {
  id: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b',
  image: '6f1c2a8f-5b6e-4d3b-9c2a-1f2c8d3a4e5b.jpg',
  title: 'Apple Juice',
  description: 'Cold-pressed apple juice with no added sugar.',
  compound: ['vitamin C', 'potassium', 'fiber'],
  price: 25000,
  type: 'juice',
  isActive: true,
  promotions: [{ type: 'buy_two_get_one_free', name: '2+1 aksiya (har 3-mahsulot bepul)' }],
  createdAt: '2025-01-12T08:00:00.000Z',
  updatedAt: '2025-01-12T08:00:00.000Z',
};

@ApiTags('Product')
@Controller('catalog/:catalogId/product')
@ApiParam({ name: 'catalogId', example: 'd7f9b3b4-9a4d-4b56-9b4a-3d2e3f1a0c4f', description: 'Parent catalog id' })
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @IsPublic()
  @ApiOperation({ summary: 'List active products in a catalog (public)' })
  @ApiOkResponse({ description: 'Active products', schema: { example: [productExample] } })
  get(@Param('catalogId') catalogId: string, @Query() query: BasicQuery) {
    return this.productService.findAll(catalogId, query.locale);
  }

  @Get('search')
  @IsPublic()
  @ApiOperation({
    summary: 'Search products by title or compound (public)',
    description: 'Case-insensitive ILIKE match against the chosen locale. Empty search returns an empty array.',
  })
  @ApiOkResponse({ description: 'Matching products', schema: { example: [productExample] } })
  search(@Query() query: SearchQuery) {
    return this.productService.search(query.locale, query.search);
  }

  @Get('all')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List all products in a catalog including inactive (admin only)',
    description:
      'Paginated (`page`/`pageSize`, defaults 1/20, capped at 50). Pass `search` to filter by title or compound, ' +
      'matched case-insensitively against the chosen locale; omit it to list everything in the catalog.',
  })
  @ApiOkResponse({
    description: 'Paginated products',
    schema: { example: { products: [productExample], total: 87, pages: 5 } },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  getAll(@Param('catalogId') catalogId: string, @Query() query: PaginatedSearchQuery) {
    return this.productService.findAllPaginated(catalogId, query.locale, query.page, query.pageSize, query.search);
  }

  @Post()
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @UseInterceptors(uploadFileInterceptor('product'))
  @ApiOperation({
    summary: 'Create a product (admin only)',
    description: 'Multipart upload. Localized fields are stored under the `locale` query param.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateProductRequest })
  @ApiCreatedResponse({ schema: { example: { message: 'Produkt yaratildi' } } })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
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
  @ApiBearerAuth('access-token')
  @UseInterceptors(uploadFileInterceptor('product'))
  @ApiOperation({
    summary: 'Update a product (admin only)',
    description: 'Multipart upload. Only provided fields are updated; localized fields merge into the chosen `locale`.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'productId', example: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b' })
  @ApiBody({ type: UpdateProductRequest })
  @ApiOkResponse({ schema: { example: { message: 'Produkt yangilandi' } } })
  @ApiBadRequestResponse({ description: 'Product not found' })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a product (admin only)' })
  @ApiParam({ name: 'productId', example: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b' })
  @ApiOkResponse({ schema: { example: { message: "Produkt o'chirildi" } } })
  async delete(@Param('productId') productId: string) {
    await this.productService.delete(productId);

    return {
      message: "Produkt o'chirildi",
    };
  }
}
