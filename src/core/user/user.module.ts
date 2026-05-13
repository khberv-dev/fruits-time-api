import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { UserService } from '@/core/user/user.service';
import { UserController } from '@/core/user/user.controller';
import { UserCron } from '@/core/user/user.cron';
import { PosterModule } from '@/core/poster/poster.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), PosterModule],
  controllers: [UserController],
  providers: [UserService, UserCron],
  exports: [UserService],
})
export class UserModule {}
