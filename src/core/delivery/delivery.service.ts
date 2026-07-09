import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { Socket } from 'net';
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
    // setMaxListeners above only covers the agent's own events; keep-alive sockets are
    // separate EventEmitters and need their own limit raised too, otherwise reusing the
    // same socket across many requests eventually trips MaxListenersExceededWarning.
    const uncapSocketListeners = (socket: unknown) => (socket as Socket).setMaxListeners(0);
    httpAgent.on('free', uncapSocketListeners);
    httpsAgent.on('free', uncapSocketListeners);

    const apiKey = this.config.get<string>('DELIVERY_API_KEY');

    this.apiClient = axios.create({
      baseURL: this.config.getOrThrow<string>('DELIVERY_API_URL'),
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      httpAgent,
      httpsAgent,
    });
  }

  async evalOrder(input: DeliveryCreateOrderInput): Promise<number | null> {
    try {
      const { data } = await this.apiClient.post<{ total_delivery_price: number; evaluated_stage: number }>(
        '/orders/eval',
        this.buildBody(input),
      );
      return data.total_delivery_price ?? null;
    } catch (error) {
      this.logger.error(`evalOrder failed: ${this.formatError(error)}`);
      return null;
    }
  }

  async createOrder(input: DeliveryCreateOrderInput): Promise<boolean> {
    this.logger.log(`createOrder: sending delivery order for ${input.vendorOrderId}`);
    try {
      await this.apiClient.post('/orders', this.buildBody(input));
      return true;
    } catch (error) {
      this.logger.error(`createOrder failed for order ${input.vendorOrderId}: ${this.formatError(error)}`);
      return false;
    }
  }

  private buildBody(input: DeliveryCreateOrderInput) {
    const deliveryItem: (typeof input.items)[number] = {
      name: 'Yetkazib berish',
      price_per_unit: input.deliveryCost ?? 0,
      quantity: 1,
      width: 0,
      height: 0,
      length: 0,
      weight: 0,
    };
    const products = { type_id: 2, description: 'Sharbat', items: [...input.items, deliveryItem] };

    return {
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
          products,
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
          products,
        },
      ],
      payment_type: 'BALANCE',
      delivery: {
        type: 'EXPRESS',
        time: null,
        send_link: true,
        door_to_door: false,
        product_paid: false,
        equipment_id: 1,
      },
    };
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
