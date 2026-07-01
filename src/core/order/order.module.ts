import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '@/shared/entities/order.entity';
import { OrderItem } from '@/shared/entities/order-item.entity';
import { Product } from '@/shared/entities/product.entity';
import { OrderController } from '@/core/order/order.controller';
import { OrderService } from '@/core/order/order.service';
import { User } from '@/shared/entities/user.entity';
import { Branch } from '@/shared/entities/branch.entity';
import { Address } from '@/shared/entities/address.entity';
import { Session } from '@/shared/entities/session.entity';
import { PosterModule } from '@/core/poster/poster.module';
import { DeliveryModule } from '@/core/delivery/delivery.module';
import { NotifyModule } from '@/core/notify/notify.module';
import { PromotionModule } from '@/core/promotion/promotion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, User, Branch, Address, Session]),
    PosterModule,
    DeliveryModule,
    NotifyModule,
    PromotionModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
