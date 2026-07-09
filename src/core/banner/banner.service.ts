import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Banner } from '@/shared/entities/banner.entity';
import { Repository } from 'typeorm';
import { Locale } from '@/shared/enums/locale.enum';
import { CreateBannerRequest } from '@/core/banner/dto/create-banner-request.dto';
import { UpdateBannerRequest } from '@/core/banner/dto/update-banner-request.dto';

@Injectable()
export class BannerService {
  constructor(@InjectRepository(Banner) private readonly bannerRepo: Repository<Banner>) {}

  async findAll(locale: Locale, filterInactive: boolean = true) {
    const qb = this.bannerRepo.createQueryBuilder('b');

    if (filterInactive) {
      qb.where('b.is_active = :isActive', { isActive: true });
    }

    const banners = await qb.getMany();
    return banners.map((banner) => ({
      ...banner,
      title: banner.getTitle(locale),
      content: banner.getContent(locale),
      image: banner.getImage(locale),
      thumbnail: banner.getThumbnail(locale),
    }));
  }

  create(locale: Locale, fileName: string, thumbnailFileName: string | null, data: CreateBannerRequest) {
    return this.bannerRepo.save({
      title: { [locale]: data.title },
      content: { [locale]: data.content },
      image: { [locale]: fileName },
      thumbnail: thumbnailFileName ? { [locale]: thumbnailFileName } : null,
      popup: data.popup ?? false,
    });
  }

  async update(
    bannerId: string,
    locale: Locale,
    fileName: string | null,
    thumbnailFileName: string | null,
    data: UpdateBannerRequest,
  ) {
    const banner = await this.bannerRepo.findOne({
      where: {
        id: bannerId,
      },
    });

    if (!banner) {
      throw new BadRequestException('Banner ID xato');
    }

    if (fileName) {
      banner.image = { ...banner.image, [locale]: fileName };
    }

    if (thumbnailFileName) {
      banner.thumbnail = { ...banner.thumbnail, [locale]: thumbnailFileName };
    }

    if (data.title) {
      banner.title = { ...banner.title, [locale]: data.title };
    }

    if (data.content) {
      banner.content = { ...banner.content, [locale]: data.content };
    }

    if (data.isActive != undefined) {
      banner.isActive = data.isActive;
    }

    if (data.popup != undefined) {
      banner.popup = data.popup;
    }

    return this.bannerRepo.save(banner);
  }
}
