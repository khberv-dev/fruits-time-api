import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvisorController } from '@/core/advisor/advisor.controller';
import { AdvisorService } from '@/core/advisor/advisor.service';
import { AdvisorInstructionsService } from '@/core/advisor/advisor-instructions.service';
import { AdvisorMessage } from '@/shared/entities/advisor-message.entity';
import { Order } from '@/shared/entities/order.entity';
import { OrderItem } from '@/shared/entities/order-item.entity';
import { Product } from '@/shared/entities/product.entity';
import { Branch } from '@/shared/entities/branch.entity';
import { User } from '@/shared/entities/user.entity';
import { Catalog } from '@/shared/entities/catalog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdvisorMessage, Order, OrderItem, Product, Branch, User, Catalog])],
  controllers: [AdvisorController],
  providers: [AdvisorService, AdvisorInstructionsService],
})
export class AdvisorModule {}
