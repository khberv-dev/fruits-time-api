import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '@/shared/entities/session.entity';
import { SessionController } from '@/core/session/session.controller';
import { SessionService } from '@/core/session/session.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
