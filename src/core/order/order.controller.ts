import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrderService } from '@/core/order/order.service';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { CreateOrderRequest } from '@/core/order/dto/create-order-request.dto';
import { BasicQuery } from '@/shared/dto/basic-query.dto';

const orderExample = {
  id: '7e9f2d3b-1234-4abc-9d8e-2c4f6a1b3c5d',
  posId: 45,
  status: 'created',
  type: 'delivery',
  address: { long: 69.2401, lat: 41.2995 },
  createdAt: '2025-05-04T10:15:00.000Z',
  updatedAt: '2025-05-04T10:15:00.000Z',
  items: [
    {
      id: 'aa11bb22-cc33-44dd-55ee-66ff77889900',
      quantity: 2,
      price: 48500,
      actualPrice: 50000,
      product: {
        id: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b',
        image: '6f1c2a8f-5b6e-4d3b-9c2a-1f2c8d3a4e5b.jpg',
        title: 'Apple Juice',
        description: 'Cold-pressed apple juice with no added sugar.',
        compound: ['vitamin C', 'potassium', 'fiber'],
        price: 25000,
        type: 'juice',
        isActive: true,
      },
    },
  ],
};

const orderExample2 = {
  id: '0c2a1e8b-9d33-4f56-87ab-12cd34ef56ab',
  posId: 46,
  status: 'delivered',
  type: 'pickup',
  address: null,
  createdAt: '2025-05-03T15:42:00.000Z',
  updatedAt: '2025-05-03T17:05:00.000Z',
  items: [
    {
      id: 'bb22cc33-dd44-55ee-66ff-778899001122',
      quantity: 1,
      price: 27160,
      actualPrice: 28000,
      product: {
        id: 'c2e5ff3d-3f1b-5a23-9b9c-4b5e6f7a8c9d',
        image: '7a2d3b9c-6c7d-4e4c-8d3b-2f3d9e4a5f6c.jpg',
        title: 'Orange Juice',
        description: 'Freshly squeezed orange juice.',
        compound: ['vitamin C', 'folate'],
        price: 28000,
        type: 'juice',
        isActive: true,
      },
    },
    {
      id: 'cc33dd44-ee55-66ff-7788-990011223344',
      quantity: 3,
      price: 78570,
      actualPrice: 81000,
      product: {
        id: 'd3f6aa4e-4a2c-6b34-acad-5c6f7a8b9c0e',
        image: '8b3e4cad-7d8e-5f5d-9e4c-3a4ebf5b6c7d.jpg',
        title: 'Carrot Juice',
        description: 'Cold-pressed carrot juice with ginger.',
        compound: ['vitamin A', 'beta-carotene'],
        price: 27000,
        type: 'juice',
        isActive: true,
      },
    },
  ],
};

@ApiTags('Order')
@ApiBearerAuth('access-token')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({
    summary: 'Place a new order for the authenticated user',
    description:
      'Creates an order with the listed product quantities. The POS-system order id is returned as `posId` once the order has been forwarded. ' +
      'All products in the order must exist and be active.',
  })
  @ApiCreatedResponse({ description: 'Order created', schema: { example: orderExample } })
  @ApiBadRequestResponse({ description: 'One or more products are missing or inactive' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  create(@RequestUser() user: ReqUser, @Query() query: BasicQuery, @Body() body: CreateOrderRequest) {
    return this.orderService.create(user.id, query.locale, body);
  }

  @Get()
  @ApiOperation({
    summary: "List the authenticated user's orders (newest first)",
  })
  @ApiOkResponse({
    description: 'All orders for the caller, newest first',
    schema: { example: [orderExample, orderExample2] },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  list(@RequestUser() user: ReqUser, @Query() query: BasicQuery) {
    return this.orderService.listForUser(user.id, query.locale);
  }
}
