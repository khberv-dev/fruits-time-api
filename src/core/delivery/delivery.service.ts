import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { ConfigService } from '@nestjs/config';
import { DeliveryCreateOrderInput } from '@/core/delivery/types/delivery-create-order-input.type';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger('Delivery Service');
  private readonly apiClient: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const httpAgent = new HttpAgent({ keepAlive: true });
    const httpsAgent = new HttpsAgent({ keepAlive: true });
    httpAgent.setMaxListeners(0);
    httpsAgent.setMaxListeners(0);

    const apiKey = this.config.get<string>('DELIVERY_API_KEY');

    this.apiClient = axios.create({
      baseURL: this.config.getOrThrow<string>('DELIVERY_API_URL'),
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
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

  async createOrder(input: DeliveryCreateOrderInput): Promise<boolean> {
    try {
      await this.apiClient.post('/orders', {
        vendor_order_id: input.vendorOrderId,
        origin: [
          {
            order: 1,
            entrance: '0',
            door_phone: '0',
            floor: 0,
            apartment: '0',
            location: input.origin.location,
            address: input.origin.address,
            client: input.origin.client,
          },
        ],
        destination: [
          {
            order: 2,
            entrance: '0',
            door_phone: '0',
            floor: 0,
            apartment: '0',
            location: input.destination.location,
            address: input.destination.address,
            client: input.destination.client,
            comment: '',
            products: {
              type_id: 2,
              description: 'Sharbat',
              items: input.items,
            },
          },
        ],
        payment_type: 'BALANCE',
        delivery: {
          type: 'EXPRESS',
          time: null,
          send_link: true,
          door_to_door: false,
          product_paid: true,
          equipment_id: 1,
        },
      });
      return true;
    } catch (error) {
      this.logger.error(`createOrder failed for order ${input.vendorOrderId}: ${this.formatError(error)}`);
      return false;
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
