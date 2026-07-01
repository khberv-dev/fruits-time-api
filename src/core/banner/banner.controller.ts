import { Body, Controller, Get, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
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
import { BannerService } from '@/core/banner/banner.service';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { uploadFileFieldsInterceptor } from '@/common/interceptors/upload-file.interceptor';
import { CreateBannerRequest } from '@/core/banner/dto/create-banner-request.dto';
import { UpdateBannerRequest } from '@/core/banner/dto/update-banner-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';

const bannerExample = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  image: 'banner-2025-summer.jpg',
  thumbnail: null,
  title: 'Summer sale',
  content: 'Up to 30% off all juices through July.',
  isActive: true,
  createdAt: '2025-06-01T00:00:00.000Z',
  updatedAt: '2025-06-01T00:00:00.000Z',
};

@ApiTags('Banner')
@Controller('banner')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get()
  @IsPublic()
  @ApiOperation({ summary: 'List active banners (public)' })
  @ApiOkResponse({ description: 'Active banners', schema: { example: [bannerExample] } })
  get(@Query() query: BasicQuery) {
    return this.bannerService.findAll(query.locale);
  }

  @Get('all')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all banners including inactive (admin only)' })
  @ApiOkResponse({ description: 'All banners', schema: { example: [bannerExample] } })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  getAll(@Query() query: BasicQuery) {
    return this.bannerService.findAll(query.locale, false);
  }

  @Post()
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @UseInterceptors(uploadFileFieldsInterceptor('banner', ['file', 'thumbnail']))
  @ApiOperation({
    summary: 'Create a banner (admin only)',
    description: 'Multipart upload. Localized fields are stored under the `locale` query param.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateBannerRequest })
  @ApiCreatedResponse({ schema: { example: { message: 'Banner yaratildi' } } })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  async create(
    @Query() query: BasicQuery,
    @UploadedFiles() files: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
    @Body() body: CreateBannerRequest,
  ) {
    await this.bannerService.create(
      query.locale,
      files.file![0].filename,
      files.thumbnail?.[0]?.filename ?? null,
      body,
    );

    return {
      message: 'Banner yaratildi',
    };
  }

  @Put(':bannerId')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @UseInterceptors(uploadFileFieldsInterceptor('banner', ['file', 'thumbnail']))
  @ApiOperation({
    summary: 'Update a banner (admin only)',
    description: 'Multipart upload. Only provided fields are updated; localized fields merge into the chosen `locale`.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'bannerId', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiBody({ type: UpdateBannerRequest })
  @ApiOkResponse({ schema: { example: { message: 'Banner yangilandi' } } })
  @ApiBadRequestResponse({ description: 'Banner not found' })
  async update(
    @Param('bannerId') bannerId: string,
    @Query() query: BasicQuery,
    @UploadedFiles() files: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
    @Body() body: UpdateBannerRequest,
  ) {
    await this.bannerService.update(
      bannerId,
      query.locale,
      files.file?.[0]?.filename ?? null,
      files.thumbnail?.[0]?.filename ?? null,
      body,
    );

    return {
      message: 'Banner yangilandi',
    };
  }
}
