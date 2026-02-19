import { Body, Controller, Get, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { PromotionService } from '@/modules/web/promotion/promotion.service';
import { fileInterceptor } from '@/common/interceptors/file.interceptor';
import { UpdateBannerRequest } from '@/modules/web/promotion/dto/update-banner-request.dto';

@Controller('promotion')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get('banners')
  getBanners() {
    return this.promotionService.getBanners();
  }

  @Post('create-banner')
  @UseInterceptors(fileInterceptor('banner'))
  createBanner(@UploadedFile() file: Express.Multer.File) {
    return this.promotionService.createBanner(file.filename);
  }

  @Put('banner/:id')
  updateBanner(@Param('id') bannerId: string, @Body() body: UpdateBannerRequest) {
    return this.promotionService.updateBanner(bannerId, body);
  }
}
