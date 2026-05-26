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
import { PosterModule } from '@/core/poster/poster.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product, User, Branch, Address]), PosterModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
