import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CatalogService } from '@/core/catalog/catalog.service';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { CreateCatalogRequest } from '@/core/catalog/dto/create-catalog-request.dto';
import { uploadFileInterceptor } from '@/common/interceptors/upload-file.interceptor';
import { UpdateCatalogRequest } from '@/core/catalog/dto/update-catalog-request.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  get(@Query() query: BasicQuery) {
    return this.catalogService.findAll(query.locale);
  }

  @Get('all')
  @Role(UserRole.ADMIN)
  getAll(@Query() query: BasicQuery) {
    return this.catalogService.findAll(query.locale, false);
  }

  @Post()
  @Role(UserRole.ADMIN)
  @UseInterceptors(uploadFileInterceptor('catalog'))
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
  @UseInterceptors(uploadFileInterceptor('catalog'))
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
  async delete(@Param('catalogId') catalogId: string) {
    await this.catalogService.delete(catalogId);

    return {
      message: "Katalog o'chirildi",
    };
  }
}
