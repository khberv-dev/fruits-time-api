import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '@/shared/entities/order.entity';
import { OrderItem } from '@/shared/entities/order-item.entity';
import { Product } from '@/shared/entities/product.entity';
import { OrderController } from '@/core/order/order.controller';
import { OrderService } from '@/core/order/order.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product])],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
