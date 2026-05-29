import { Module } from '@nestjs/common';
import { DeliveryService } from '@/core/delivery/delivery.service';

@Module({
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
