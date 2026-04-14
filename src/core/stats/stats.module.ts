import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from '@/shared/entities/catalog.entity';
import { User } from '@/shared/entities/user.entity';
import { Product } from '@/shared/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Catalog, Product])],
  controllers: [],
  providers: [],
})
export class StatsModule {}
