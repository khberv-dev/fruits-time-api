import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { PosterCreateOrderInput } from '@/core/poster/types/poster-create-order-input.type';
import { PosterResponse } from '@/core/poster/types/poster-response.type';
import { PosterOrderResponse } from '@/core/poster/types/poster-order-response.type';

@Injectable()
export class PosterService {
  private readonly logger = new Logger('Poster Service');
  private readonly apiClient: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.apiClient = axios.create({
      baseURL: this.config.getOrThrow<string>('POSTER_API_URL'),
      params: { token: this.config.getOrThrow<string>('POSTER_API_KEY') },
    });
  }

  async createClient(clientName: string, phone: string): Promise<number | null> {
    try {
      const { data } = await this.apiClient.post<PosterResponse<number | string>>('/clients.createClient', {
        client_name: clientName,
        phone,
      });

      const id = data.response;
      if (id === undefined || id === null) return null;
      return typeof id === 'number' ? id : Number(id);
    } catch (error) {
      this.logger.error(`createClient failed: ${this.formatError(error)}`);
      return null;
    }
  }

  async createOrder(input: PosterCreateOrderInput): Promise<number | null> {
    try {
      const { data } = await this.apiClient.post<PosterResponse<PosterOrderResponse>>('/orders', {
        spotId: input.spotId,
        autoAccept: input.autoAccept,
        client: { id: input.client.id },
        products: input.products.map((product) => ({
          id: product.id,
          count: product.count,
        })),
      });

      const id = data.response?.id;
      return typeof id === 'number' ? id : id ? Number(id) : null;
    } catch (error) {
      this.logger.error(`createOrder failed: ${this.formatError(error)}`);
      return null;
    }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return `${error.message} ${JSON.stringify(error.response?.data ?? {})}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
