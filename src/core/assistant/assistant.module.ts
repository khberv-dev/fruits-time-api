import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { AssistantController } from '@/core/assistant/assistant.controller';
import { AssistantService } from '@/core/assistant/assistant.service';
import { InstructionsService } from '@/core/assistant/instructions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [AssistantController],
  providers: [AssistantService, InstructionsService],
})
export class AssistantModule {}
