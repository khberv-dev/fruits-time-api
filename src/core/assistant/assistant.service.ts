import { Injectable, OnModuleInit } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { InstructionsService } from '@/core/assistant/instructions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { Repository } from 'typeorm';
import { Locale } from '@/shared/enums/locale.enum';

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

  async ask(locale: Locale, text: string) {
    const products = await this.productRepo.find({
      where: {
        isActive: true,
      },
    });

    const chat = this.ai.chats.create({
      model: this.config.getOrThrow('GENAI_MODEL'),
      config: {
        systemInstruction: this.instructionService.buildNutritionistInstructions(products),
      },
    });

    const response = await chat.sendMessage({
      message: text,
    });

    const message = JSON.parse(response.candidates![0].content!.parts![0].text || '{}');
    const suggestedProductIds: string[] = message['suggestions'];
    const suggestedProducts = await Promise.all(
      suggestedProductIds.map(async (id) => {
        const product = await this.productRepo.findOne({ where: { id } });

        return {
          ...product,
          title: product?.getTitle(locale),
          description: product?.getDescription(locale),
          compound: product?.getCompound(locale),
        };
      }),
    );

    return { text: message.text, suggestions: suggestedProducts };
  }
}
