import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdBanner } from '@/shared/entities/ad-banner.entity';
import { PromotionController } from '@/modules/app/promotion/promotion.controller';
import { PromotionService } from '@/modules/app/promotion/promotion.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdBanner])],
  controllers: [PromotionController],
  providers: [PromotionService],
})
export class PromotionModule {}
