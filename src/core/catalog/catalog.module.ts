import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from '@/shared/entities/catalog.entity';
import { CatalogController } from '@/core/catalog/catalog.controller';
import { CatalogService } from '@/core/catalog/catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([Catalog])],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
