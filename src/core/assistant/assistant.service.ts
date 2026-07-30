import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import { InstructionsService } from '@/core/assistant/instructions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/shared/entities/product.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Locale } from '@/shared/enums/locale.enum';
import { UserService } from '@/core/user/user.service';
import { AssistantMessage } from '@/shared/entities/assistant-message.entity';
import { MessageRole } from '@/shared/enums/message-role.enum';
import { User } from '@/shared/entities/user.entity';

const PRODUCTS_TTL_MS = 60_000;
// Matches the window the endpoint's API docs advertise.
const CONTEXT_WINDOW_MINUTES = 60;

@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);
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

  // `since` scopes the rows to a recent window for model context; the history endpoint omits
  // it and returns the full conversation, which is what the client renders.
  private async loadHistory(userId: string, since?: Date): Promise<AssistantMessage[]> {
    return this.messageRepo.find({
      where: { user: { id: userId }, ...(since ? { createdAt: MoreThanOrEqual(since) } : {}) },
      order: { createdAt: 'ASC' },
    });
  }

  async ask(locale: Locale, userId: string, text: string) {
    // Only the recent window is replayed as context — resending the entire conversation grew
    // the request without bound as a user kept chatting.
    const [user, products, history] = await Promise.all([
      this.userService.findById(userId),
      this.getActiveProducts(),
      this.loadHistory(userId, dayjs().subtract(CONTEXT_WINDOW_MINUTES, 'minutes').toDate()),
    ]);

    const contents = [
      ...history.map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
      { role: MessageRole.USER, parts: [{ text }] },
    ];

    let response;
    try {
      response = await this.ai.models.generateContent({
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
              cart: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['hasAnswer', 'text', 'suggestions', 'cart'],
          },
        },
      });
    } catch (error) {
      this.logger.error(`generateContent failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

    const responseText = response.text ?? '{}';

    let message: { hasAnswer?: boolean; text?: string; suggestions?: string[]; cart?: string[] } = {};
    try {
      message = JSON.parse(responseText);
    } catch {
      message = {};
    }

    await this.messageRepo.save([
      { user: { id: userId } as User, role: MessageRole.USER, text },
      { user: { id: userId } as User, role: MessageRole.MODEL, text: responseText },
    ]);

    const cart = this.resolveCart(message.cart, products);
    // Cart entries are bare ids; the client resolves them against `suggestions`,
    // so anything going into the cart must ship its product payload too.
    const suggestions = this.resolveSuggestions([...(message.suggestions ?? []), ...cart], products, locale);

    return { text: message.text ?? '', suggestions, cart };
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

      let parsed: { text?: string; suggestions?: string[]; cart?: string[] };
      try {
        parsed = JSON.parse(message.text) as { text?: string; suggestions?: string[]; cart?: string[] };
      } catch {
        parsed = {};
      }

      const cart = this.resolveCart(parsed.cart, products);

      return {
        id: message.id,
        role: message.role,
        text: parsed.text ?? '',
        suggestions: this.resolveSuggestions([...(parsed.suggestions ?? []), ...cart], products, locale),
        cart,
        createdAt: message.createdAt,
      };
    });
  }

  private resolveCart(ids: string[] | undefined, products: Product[]): string[] {
    if (!ids?.length) return [];
    const wanted = new Set(ids);
    return products.filter((p) => wanted.has(p.id) && p.available?.some((a) => a.left)).map((p) => p.id);
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
