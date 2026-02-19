import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AdBanner } from '@/shared/entities/ad-banner.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PromotionService {
  constructor(@InjectRepository(AdBanner) private readonly adBannerRepo: Repository<AdBanner>) {}

  getBanners() {
    return this.adBannerRepo.find({
      where: {
        isActive: true,
      },
      order: {
        createdAt: 'desc',
      },
    });
  }
}
