import { Controller, Get } from '@nestjs/common';
import { PromotionService } from '@/modules/app/promotion/promotion.service';
import { Public } from '@/common/decorators/public.decorator';

@Public()
@Controller('app/promotion')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get('banners')
  getBanners() {
    return this.promotionService.getBanners();
  }
}
