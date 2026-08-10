import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '@/shared/entities/subscription.entity';
import { SubscriptionCode } from '@/shared/entities/subscription-code.entity';
import { SubscriptionRedemption } from '@/shared/entities/subscription-redemption.entity';
import { SubscriptionRequest } from '@/shared/entities/subscription-request.entity';
import { Product } from '@/shared/entities/product.entity';
import { SubscriptionController } from '@/core/subscription/subscription.controller';
import { SubscriptionService } from '@/core/subscription/subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, SubscriptionCode, SubscriptionRedemption, SubscriptionRequest, Product]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
