import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvisorMessage } from '@/shared/entities/advisor-message.entity';
import { AdvisorInstructionsService } from '@/core/advisor/advisor-instructions.service';
import { MessageRole } from '@/shared/enums/message-role.enum';
import { User } from '@/shared/entities/user.entity';

@Injectable()
export class AdvisorService implements OnModuleInit {
  private readonly logger = new Logger(AdvisorService.name);
  private ai: GoogleGenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly instructionsService: AdvisorInstructionsService,
    @InjectRepository(AdvisorMessage) private readonly messageRepo: Repository<AdvisorMessage>,
  ) {}

  onModuleInit() {
    this.ai = new GoogleGenAI({ apiKey: this.config.getOrThrow('GENAI_KEY') });
  }

  private async loadHistory(userId: string): Promise<AdvisorMessage[]> {
    return this.messageRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
    });
  }

  async ask(userId: string, text: string) {
    const [systemInstruction, history] = await Promise.all([
      this.instructionsService.buildSnapshot(),
      this.loadHistory(userId),
    ]);

    const contents = [
      ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: MessageRole.USER, parts: [{ text }] },
    ];

    let response;
    try {
      response = await this.ai.models.generateContent({
        model: this.config.getOrThrow('GENAI_MODEL'),
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hasAnswer: { type: Type.BOOLEAN },
              text: { type: Type.STRING },
            },
            required: ['hasAnswer', 'text'],
          },
        },
      });
    } catch (error) {
      this.logger.error(`generateContent failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

    const responseText = response.text ?? '{}';

    let message: { hasAnswer?: boolean; text?: string } = {};
    try {
      message = JSON.parse(responseText);
    } catch {
      message = {};
    }

    await this.messageRepo.save([
      { user: { id: userId } as User, role: MessageRole.USER, text },
      { user: { id: userId } as User, role: MessageRole.MODEL, text: responseText },
    ]);

    return { hasAnswer: message.hasAnswer ?? false, text: message.text ?? '' };
  }

  async history(userId: string) {
    const messages = await this.loadHistory(userId);

    return messages.map((message) => {
      if (message.role === MessageRole.USER) {
        return { id: message.id, role: message.role, text: message.text, createdAt: message.createdAt };
      }

      let parsed: { hasAnswer?: boolean; text?: string } = {};
      try {
        parsed = JSON.parse(message.text) as { hasAnswer?: boolean; text?: string };
      } catch {
        parsed = {};
      }

      return {
        id: message.id,
        role: message.role,
        hasAnswer: parsed.hasAnswer ?? false,
        text: parsed.text ?? '',
        createdAt: message.createdAt,
      };
    });
  }
}
