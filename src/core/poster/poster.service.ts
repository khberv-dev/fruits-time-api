import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { ConfigService } from '@nestjs/config';
import { PosterCreateOrderInput } from '@/core/poster/types/poster-create-order-input.type';
import { PosterResponse } from '@/core/poster/types/poster-response.type';
import { PosterOrderResponse } from '@/core/poster/types/poster-order-response.type';
import { PosterSpot } from '@/core/poster/types/poster-spot.type';
import { PosterStorage } from '@/core/poster/types/poster-storage.type';

@Injectable()
export class PosterService {
  private readonly logger = new Logger('Poster Service');
  private readonly apiClient: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const httpAgent = new HttpAgent({ keepAlive: true });
    const httpsAgent = new HttpsAgent({ keepAlive: true });
    httpAgent.setMaxListeners(0);
    httpsAgent.setMaxListeners(0);

    this.apiClient = axios.create({
      baseURL: this.config.getOrThrow<string>('POSTER_API_URL'),
      params: { token: this.config.getOrThrow<string>('POSTER_API_KEY') },
      httpAgent,
      httpsAgent,
    });

    this.apiClient.interceptors.request.use((config) => {
      this.logger.log(
        `→ ${config.method?.toUpperCase()} ${config.url ?? ''} body=${JSON.stringify(config.data ?? null)}`,
      );
      return config;
    });

    this.apiClient.interceptors.response.use((response) => {
      this.logger.log(
        `← ${response.status} ${response.config.url ?? ''} body=${JSON.stringify(response.data ?? null)}`,
      );
      return response;
    });
  }

  async getSpots(): Promise<PosterSpot[]> {
    try {
      const { data } = await this.apiClient.get<PosterResponse<PosterSpot[]>>('/spots.getSpots');

      if (data.error !== undefined && data.error !== 0) {
        this.logger.error(`getSpots failed: [${JSON.stringify(data.error)}]`);
        return [];
      }

      return data.response ?? [];
    } catch (error) {
      this.logger.error(`getSpots failed: ${this.formatError(error)}`);
      return [];
    }
  }

  async createClient(clientName: string, phone: string): Promise<number | null> {
    try {
      const { data } = await this.apiClient.post<PosterResponse<number | string>>('/clients.createClient', {
        client_name: clientName,
        client_groups_id_client: 1,
        phone,
      });

      if (data.error !== undefined && data.error !== 0) {
        this.logger.error(
          `createClient failed for ${clientName} (${phone}): [${data.error['message'] || JSON.stringify(data.error)}]`,
        );
        return null;
      }

      const id = data.response;
      if (id === undefined || id === null) {
        this.logger.error(`createClient failed for ${clientName} (${phone}): empty response ${JSON.stringify(data)}`);
        return null;
      }
      return typeof id === 'number' ? id : Number(id);
    } catch (error) {
      this.logger.error(`createClient failed for ${clientName} (${phone}): ${this.formatError(error)}`);
      return null;
    }
  }

  async createOrder(input: PosterCreateOrderInput): Promise<number | null> {
    try {
      const { data } = await this.apiClient.post<PosterResponse<PosterOrderResponse>>('/orders', {
        spotId: input.spotId,
        autoAccept: input.autoAccept,
        serviceMode: input.serviceMode,
        client: { id: input.client.id },
        products: input.products.map((product) => ({
          id: product.id,
          count: product.count,
          ...(product.price !== undefined ? { price: product.price } : {}),
        })),
        ...(input.delivery !== undefined ? { delivery: input.delivery } : {}),
      });

      if (data.error !== undefined && data.error !== 0) {
        this.logger.error(`createOrder failed: [${data.error}] ${data.message ?? 'no message'}`);
        return null;
      }

      const id = data.response?.id;
      if (id === undefined || id === null) {
        this.logger.error(`createOrder failed: empty response ${JSON.stringify(data)}`);
        return null;
      }
      return typeof id === 'number' ? id : Number(id);
    } catch (error) {
      this.logger.error(`createOrder failed: ${this.formatError(error)}`);
      return null;
    }
  }

  async getStorages(): Promise<PosterStorage[]> {
    try {
      const { data } = await this.apiClient.get<PosterResponse<PosterStorage[]>>('/storage.getStorages');

      if (data.error !== undefined && data.error !== 0) {
        this.logger.error(`getStorages failed: [${JSON.stringify(data.error)}]`);
        return [];
      }

      return data.response ?? [];
    } catch (error) {
      this.logger.error(`getStorages failed: ${this.formatError(error)}`);
      return [];
    }
  }

  async getProduct(productId: number): Promise<number[] | null> {
    try {
      const { data } = await this.apiClient.get<
        PosterResponse<{ ingredients?: { ingredient_id: string }[] }>
      >('/menu.getProduct', { params: { product_id: productId } });

      if (data.error !== undefined && data.error !== 0) {
        this.logger.error(`getProduct failed for ${productId}: [${JSON.stringify(data.error)}]`);
        return null;
      }

      return (data.response?.ingredients ?? []).map((i) => Number(i.ingredient_id));
    } catch (error) {
      this.logger.error(`getProduct failed for ${productId}: ${this.formatError(error)}`);
      return null;
    }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'no-status';
      const body = error.response?.data ? JSON.stringify(error.response.data) : 'no-body';
      return `[${status}] ${error.message} ${body}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
