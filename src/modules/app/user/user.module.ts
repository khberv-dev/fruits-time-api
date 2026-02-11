import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { UserService } from '@/modules/app/user/user.service';
import { UserController } from '@/modules/app/user/user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
