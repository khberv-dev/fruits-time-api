import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { AuthModule } from '@/core/auth/auth.module';
import { UserService } from '@/core/user/user.service';
import { UserController } from '@/core/user/user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
