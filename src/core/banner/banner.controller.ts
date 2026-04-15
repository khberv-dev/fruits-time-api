import { Body, Controller, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { BannerService } from '@/core/banner/banner.service';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { uploadFileInterceptor } from '@/common/interceptors/upload-file.interceptor';
import { CreateBannerRequest } from '@/core/banner/dto/create-banner-request.dto';
import { UpdateBannerRequest } from '@/core/banner/dto/update-banner-request.dto';

@Controller('banner')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get()
  get(@Query() query: BasicQuery) {
    return this.bannerService.findAll(query.locale);
  }

  @Get('all')
  @Role(UserRole.ADMIN)
  getAll(@Query() query: BasicQuery) {
    return this.bannerService.findAll(query.locale, false);
  }

  @Post()
  @Role(UserRole.ADMIN)
  @UseInterceptors(uploadFileInterceptor('banner'))
  async create(
    @Query() query: BasicQuery,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateBannerRequest,
  ) {
    await this.bannerService.create(query.locale, file.filename, body);

    return {
      message: 'Banner yaratildi',
    };
  }

  @Put(':bannerId')
  @Role(UserRole.ADMIN)
  @UseInterceptors(uploadFileInterceptor('banner'))
  async update(
    @Param('bannerId') bannerId: string,
    @Query() query: BasicQuery,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UpdateBannerRequest,
  ) {
    await this.bannerService.update(bannerId, query.locale, file?.filename, body);

    return {
      message: 'Banner yangilandi',
    };
  }
}
