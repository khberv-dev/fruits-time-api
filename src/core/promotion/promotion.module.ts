import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from '@/shared/entities/promotion.entity';
import { Order } from '@/shared/entities/order.entity';
import { OrderItem } from '@/shared/entities/order-item.entity';
import { PromotionController } from '@/core/promotion/promotion.controller';
import { PromotionService } from '@/core/promotion/promotion.service';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, Order, OrderItem])],
  controllers: [PromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
