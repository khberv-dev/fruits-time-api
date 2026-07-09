import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { Socket } from 'net';
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
    // setMaxListeners above only covers the agent's own events; keep-alive sockets are
    // separate EventEmitters and need their own limit raised too, otherwise reusing the
    // same socket across many requests eventually trips MaxListenersExceededWarning.
    const uncapSocketListeners = (socket: unknown) => (socket as Socket).setMaxListeners(0);
    httpAgent.on('free', uncapSocketListeners);
    httpsAgent.on('free', uncapSocketListeners);

    this.apiClient = axios.create({
      baseURL: this.config.getOrThrow<string>('POSTER_API_URL'),
      params: { token: this.config.getOrThrow<string>('POSTER_API_KEY') },
      httpAgent,
      httpsAgent,
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

  async getStorageLeftovers(storageId: number): Promise<Map<number, boolean>> {
    try {
      const { data } = await this.apiClient.get<
        PosterResponse<{ ingredient_id: string; storage_ingredient_left: string }[]>
      >('/storage.getStorageLeftovers', { params: { storage_id: storageId } });

      if (data.error !== undefined && data.error !== 0) {
        this.logger.error(`getStorageLeftovers failed for storage ${storageId}: [${JSON.stringify(data.error)}]`);
        return new Map();
      }

      const map = new Map<number, boolean>();
      for (const item of data.response ?? []) {
        map.set(Number(item.ingredient_id), parseFloat(item.storage_ingredient_left) > 0);
      }
      return map;
    } catch (error) {
      this.logger.error(`getStorageLeftovers failed for storage ${storageId}: ${this.formatError(error)}`);
      return new Map();
    }
  }

  async getTransactions(): Promise<number[]> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const format = (date: Date) => date.toISOString().slice(0, 10);

      const { data } = await this.apiClient.get<PosterResponse<{ data: { transaction_id: number }[] }>>(
        '/transactions.getTransactions',
        { params: { date_from: format(yesterday), date_to: format(today) } },
      );

      if (data.error !== undefined && data.error !== 0) {
        this.logger.error(`getTransactions failed: [${JSON.stringify(data.error)}]`);
        return [];
      }

      return (data.response?.data ?? []).map((t) => t.transaction_id);
    } catch (error) {
      this.logger.error(`getTransactions failed: ${this.formatError(error)}`);
      return [];
    }
  }

  async getProduct(productId: number): Promise<number[] | null> {
    try {
      const { data } = await this.apiClient.get<
        PosterResponse<{ ingredient_id?: string; ingredients?: { ingredient_id: string }[] }>
      >('/menu.getProduct', { params: { product_id: productId } });

      if (data.error !== undefined && data.error !== 0) {
        this.logger.error(`getProduct failed for ${productId}: [${JSON.stringify(data.error)}]`);
        return null;
      }

      const ingredients = data.response?.ingredients ?? [];
      if (ingredients.length > 0) {
        return ingredients.map((i) => Number(i.ingredient_id));
      }

      const fallbackId = Number(data.response?.ingredient_id);
      return fallbackId ? [fallbackId] : [];
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
