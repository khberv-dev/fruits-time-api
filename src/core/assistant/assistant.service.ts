import { Injectable, OnModuleInit } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { InstructionsService } from '@/core/assistant/instructions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AssistantService implements OnModuleInit {
  private ai: GoogleGenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly instructionService: InstructionsService,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  onModuleInit() {
    this.ai = new GoogleGenAI({ apiKey: this.config.getOrThrow('GENAI_KEY') });
  }

  async startChat(text: string) {
    const products = await this.productRepo.find({
      where: {
        isActive: true,
      },
    });

    const id = randomUUID();
    const chat = this.ai.chats.create({
      model: this.config.getOrThrow('GENAI_MODEL'),
      config: {
        systemInstruction: this.instructionService.buildNutritionistInstructions(products),
      },
    });

    return chat.sendMessage({
      message: text,
    });
  }
}
