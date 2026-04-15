import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banner } from '@/shared/entities/banner.entity';
import { BannerController } from '@/core/banner/banner.controller';
import { BannerService } from '@/core/banner/banner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Banner])],
  controllers: [BannerController],
  providers: [BannerService],
})
export class BannerModule {}
