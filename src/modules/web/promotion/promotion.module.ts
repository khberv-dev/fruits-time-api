import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdBanner } from '@/shared/entities/ad-banner.entity';
import { PromotionController } from '@/modules/web/promotion/promotion.controller';
import { PromotionService } from '@/modules/web/promotion/promotion.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdBanner])],
  controllers: [PromotionController],
  providers: [PromotionService],
})
export class PromotionWebModule {}
