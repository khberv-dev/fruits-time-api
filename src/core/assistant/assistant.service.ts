import { Injectable, OnModuleInit } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { InstructionsService } from '@/core/assistant/instructions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { Repository } from 'typeorm';
import { Locale } from '@/shared/enums/locale.enum';
import { UserService } from '@/core/user/user.service';
import { AssistantMessage } from '@/shared/entities/assistant-message.entity';
import { MessageRole } from '@/shared/enums/message-role.enum';
import { User } from '@/shared/entities/user.entity';

const PRODUCTS_TTL_MS = 60_000;
const SESSION_GAP_MS = 60 * 60 * 1000;
const SESSION_FETCH_CAP = 200;

@Injectable()
export class AssistantService implements OnModuleInit {
  private ai: GoogleGenAI;
  private productsCache: { products: Product[]; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly instructionService: InstructionsService,
    private readonly userService: UserService,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(AssistantMessage) private readonly messageRepo: Repository<AssistantMessage>,
  ) {}

  onModuleInit() {
    this.ai = new GoogleGenAI({ apiKey: this.config.getOrThrow('GENAI_KEY') });
  }

  private async getActiveProducts(): Promise<Product[]> {
    const now = Date.now();
    if (this.productsCache && this.productsCache.expiresAt > now) {
      return this.productsCache.products;
    }

    const products = await this.productRepo.find({ where: { isActive: true } });
    this.productsCache = { products, expiresAt: now + PRODUCTS_TTL_MS };
    return products;
  }

  private async loadHistory(userId: string): Promise<AssistantMessage[]> {
    const recent = await this.messageRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: SESSION_FETCH_CAP,
    });

    const session: AssistantMessage[] = [];
    let cursor: number | null = null;
    for (const message of recent) {
      if (cursor !== null && cursor - message.createdAt.getTime() > SESSION_GAP_MS) break;
      session.push(message);
      cursor = message.createdAt.getTime();
    }

    return session.reverse();
  }

  async ask(locale: Locale, userId: string, text: string) {
    const [user, products, history] = await Promise.all([
      this.userService.findById(userId),
      this.getActiveProducts(),
      this.loadHistory(userId),
    ]);

    const contents = [
      ...history.map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
      { role: MessageRole.USER, parts: [{ text }] },
    ];

    const response = await this.ai.models.generateContent({
      model: this.config.getOrThrow('GENAI_MODEL'),
      contents,
      config: {
        systemInstruction: this.instructionService.buildNutritionistInstructions(products, user),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasAnswer: { type: Type.BOOLEAN },
            text: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['hasAnswer', 'text', 'suggestions'],
        },
      },
    });

    const responseText = response.text ?? '{}';

    let message: { hasAnswer?: boolean; text?: string; suggestions?: string[] } = {};
    try {
      message = JSON.parse(responseText);
    } catch {
      message = {};
    }

    await this.messageRepo.save([
      { user: { id: userId } as User, role: MessageRole.USER, text },
      { user: { id: userId } as User, role: MessageRole.MODEL, text: responseText },
    ]);

    const suggestions = this.resolveSuggestions(message.suggestions, products, locale);

    return { text: message.text ?? '', suggestions };
  }

  async history(locale: Locale, userId: string) {
    const [messages, products] = await Promise.all([this.loadHistory(userId), this.getActiveProducts()]);

    return messages.map((message) => {
      if (message.role === MessageRole.USER) {
        return {
          id: message.id,
          role: message.role,
          text: message.text,
          createdAt: message.createdAt,
        };
      }

      let parsed: { text?: string; suggestions?: string[] };
      try {
        parsed = JSON.parse(message.text) as { text?: string; suggestions?: string[] };
      } catch {
        parsed = {};
      }

      return {
        id: message.id,
        role: message.role,
        text: parsed.text ?? '',
        suggestions: this.resolveSuggestions(parsed.suggestions, products, locale),
        createdAt: message.createdAt,
      };
    });
  }

  private resolveSuggestions(ids: string[] | undefined, products: Product[], locale: Locale) {
    if (!ids?.length) return [];

    const wanted = new Set(ids);
    return products
      .filter((product) => wanted.has(product.id))
      .map((product) => ({
        ...product,
        title: product.getTitle(locale),
        description: product.getDescription(locale),
        compound: product.getCompound(locale),
      }));
  }
}
