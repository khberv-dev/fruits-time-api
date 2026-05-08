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
import { PaginationQuery } from '@/shared/dto/pagination-query.dto';

const orderExample = {
  id: '7e9f2d3b-1234-4abc-9d8e-2c4f6a1b3c5d',
  orderId: 1042,
  status: 'created',
  createdAt: '2025-05-04T10:15:00.000Z',
  updatedAt: '2025-05-04T10:15:00.000Z',
  items: [
    {
      id: 'aa11bb22-cc33-44dd-55ee-66ff77889900',
      quantity: 2,
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

@ApiTags('Order')
@ApiBearerAuth('access-token')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({
    summary: 'Place a new order for the authenticated user',
    description:
      'Creates an order with the listed product quantities. The auto-incremented `orderId` (int) is returned for POS-system integration. ' +
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
    summary: "List the authenticated user's orders (paginated, newest first)",
  })
  @ApiOkResponse({
    description: 'Paginated orders for the caller',
    schema: {
      example: {
        orders: [orderExample],
        total: 7,
        pages: 1,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  list(@RequestUser() user: ReqUser, @Query() query: PaginationQuery) {
    return this.orderService.listForUser(user.id, query.locale, query.page, query.pageSize);
  }
}
