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
import { CatalogService } from '@/core/catalog/catalog.service';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { CreateCatalogRequest } from '@/core/catalog/dto/create-catalog-request.dto';
import { uploadFileInterceptor } from '@/common/interceptors/upload-file.interceptor';
import { UpdateCatalogRequest } from '@/core/catalog/dto/update-catalog-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';

const catalogExample = {
  id: 'd7f9b3b4-9a4d-4b56-9b4a-3d2e3f1a0c4f',
  image: '4f1c2a8f-5b6e-4d3b-9c2a-1f2c8d3a4e5b.jpg',
  title: 'Juices',
  isActive: true,
  productsCount: 12,
  createdAt: '2025-01-10T08:00:00.000Z',
  updatedAt: '2025-01-10T08:00:00.000Z',
};

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @IsPublic()
  @ApiOperation({ summary: 'List active catalogs (public)' })
  @ApiOkResponse({ description: 'Active catalogs', schema: { example: [catalogExample] } })
  get(@Query() query: BasicQuery) {
    return this.catalogService.findAll(query.locale);
  }

  @Get('all')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all catalogs including inactive (admin only)' })
  @ApiOkResponse({ description: 'All catalogs', schema: { example: [catalogExample] } })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  getAll(@Query() query: BasicQuery) {
    return this.catalogService.findAll(query.locale, false);
  }

  @Post()
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @UseInterceptors(uploadFileInterceptor('catalog'))
  @ApiOperation({
    summary: 'Create a catalog (admin only)',
    description: 'Multipart upload — `title` is stored in the locale specified by the `locale` query param.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCatalogRequest })
  @ApiCreatedResponse({ schema: { example: { message: 'Katalog yaratildi' } } })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  async create(
    @Query() query: BasicQuery,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateCatalogRequest,
  ) {
    await this.catalogService.create(query.locale, file.filename, body);

    return {
      message: 'Katalog yaratildi',
    };
  }

  @Put(':catalogId')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @UseInterceptors(uploadFileInterceptor('catalog'))
  @ApiOperation({
    summary: 'Update a catalog (admin only)',
    description:
      'Multipart upload. Any field is optional — only provided fields are updated. `title` is merged into the locale specified by the `locale` query param.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'catalogId', example: 'd7f9b3b4-9a4d-4b56-9b4a-3d2e3f1a0c4f' })
  @ApiBody({ type: UpdateCatalogRequest })
  @ApiOkResponse({ schema: { example: { message: 'Katalog yangilandi' } } })
  @ApiBadRequestResponse({ description: 'Catalog not found' })
  async update(
    @Param('catalogId') catalogId: string,
    @Query() query: BasicQuery,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UpdateCatalogRequest,
  ) {
    await this.catalogService.update(catalogId, query.locale, file?.filename, body);

    return {
      message: 'Katalog yangilandi',
    };
  }

  @Delete(':catalogId')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete a catalog (admin only)',
    description: 'Fails if the catalog still has products attached.',
  })
  @ApiParam({ name: 'catalogId', example: 'd7f9b3b4-9a4d-4b56-9b4a-3d2e3f1a0c4f' })
  @ApiOkResponse({ schema: { example: { message: "Katalog o'chirildi" } } })
  @ApiBadRequestResponse({ description: 'Catalog not found or still has products' })
  async delete(@Param('catalogId') catalogId: string) {
    await this.catalogService.delete(catalogId);

    return {
      message: "Katalog o'chirildi",
    };
  }
}
