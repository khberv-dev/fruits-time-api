import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from '@/shared/entities/catalog.entity';
import { User } from '@/shared/entities/user.entity';
import { Product } from '@/shared/entities/product.entity';
import { StatsController } from '@/core/stats/stats.controller';
import { StatsService } from '@/core/stats/stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Catalog, Product])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
