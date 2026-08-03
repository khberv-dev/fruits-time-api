import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { UserService } from '@/core/user/user.service';
import { UserController } from '@/core/user/user.controller';
import { PosterModule } from '@/core/poster/poster.module';
import { OrderModule } from '@/core/order/order.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), PosterModule, OrderModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
