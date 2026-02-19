import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AdBanner } from '@/shared/entities/ad-banner.entity';
import { Repository } from 'typeorm';
import { UpdateBannerRequest } from '@/modules/web/promotion/dto/update-banner-request.dto';

@Injectable()
export class PromotionService {
  constructor(@InjectRepository(AdBanner) private readonly adBannerRepo: Repository<AdBanner>) {}

  getBanners() {
    return this.adBannerRepo.find({
      order: {
        createdAt: 'desc',
      },
    });
  }

  async createBanner(fileName: string) {
    await this.adBannerRepo.save({
      image: fileName,
    });

    return {
      message: "Banner qo'shildi",
    };
  }

  async updateBanner(bannerId: string, data: UpdateBannerRequest) {
    await this.adBannerRepo.update(bannerId, data);

    return {
      message: "Ma'lumot yangilandi",
    };
  }
}
