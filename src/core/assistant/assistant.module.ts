import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { AssistantController } from '@/core/assistant/assistant.controller';
import { AssistantService } from '@/core/assistant/assistant.service';
import { InstructionsService } from '@/core/assistant/instructions.service';
import { UserModule } from '@/core/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), UserModule],
  controllers: [AssistantController],
  providers: [AssistantService, InstructionsService],
})
export class AssistantModule {}
