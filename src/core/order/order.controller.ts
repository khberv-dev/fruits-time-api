import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
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
import { DeliveryCostQuery } from '@/core/order/dto/delivery-cost-query.dto';
import { BasicQuery } from '@/shared/dto/basic-query.dto';
import { PaginationQuery } from '@/shared/dto/pagination-query.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';

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

const evaluateOrderExample = {
  items: [
    {
      productId: 'b1d4ee2c-2e9a-4f12-9a8b-3a4d5e6f7a8b',
      title: 'Apple Juice',
      quantity: 2,
      unitPrice: 25000,
      lineTotal: 50000,
      price: 35000,
    },
    {
      productId: 'c2e5ff3d-3f1b-5a23-9b9c-4b5e6f7a8c9d',
      title: 'Orange Juice',
      quantity: 3,
      unitPrice: 28000,
      lineTotal: 84000,
      price: 56000,
    },
  ],
  productsCount: 5,
  productTypesCount: 2,
  subtotal: 134000,
  discounts: [{ name: 'Birinchi buyurtma uchun chegirma', amount: 15000 }],
  discountTotal: 43000,
  deliveryCost: 12000,
  total: 103000,
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

  @Post('evaluate')
  @HttpCode(200)
  @ApiOperation({
    summary: "Evaluate an order's price before creating it",
    description:
      'Computes the same pricing that order creation would use — per-item price after discounts, the delivery ' +
      'cost when `type` is `delivery`, a breakdown of every discount applied (name + amount), `productsCount`/' +
      '`productTypesCount` (total unit count and distinct product count across the order, including any units ' +
      'auto-added by a promotion like buy-two-get-one-free), and the overall total — without persisting ' +
      'anything or contacting the POS.',
  })
  @ApiOkResponse({ description: 'Order price evaluation', schema: { example: evaluateOrderExample } })
  @ApiBadRequestResponse({ description: 'One or more products/branch/address are missing or invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  evaluate(@RequestUser() user: ReqUser, @Query() query: BasicQuery, @Body() body: CreateOrderRequest) {
    return this.orderService.evaluate(user.id, query.locale, body);
  }

  @Get('delivery-cost')
  @ApiOperation({ summary: 'Calculate delivery cost from a branch to a saved address' })
  @ApiOkResponse({ description: 'Delivery cost in UZS', schema: { example: { cost: 27500 } } })
  @ApiBadRequestResponse({ description: 'Branch or address not found / branch has no coordinates' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getDeliveryCost(@RequestUser() user: ReqUser, @Query() query: DeliveryCostQuery) {
    return this.orderService.getDeliveryCost(user.id, query.branchId, query.addressId);
  }

  @Get('active')
  @ApiOperation({ summary: "Get the authenticated user's active (pending) order, or null" })
  @ApiOkResponse({ description: 'Active order or null', schema: { example: orderExample } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getActive(@RequestUser() user: ReqUser, @Query() query: BasicQuery) {
    return this.orderService.getActiveForUser(user.id, query.locale);
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

  @Get('admin')
  @Role(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all orders (admin, newest first, paginated)' })
  @ApiOkResponse({
    description: 'Paginated order list with user and item details',
    schema: {
      example: {
        data: [{ ...orderExample, user: { id: 'uuid', firstName: 'Ali', phoneNumber: '+998901234567' } }],
        total: 42,
        page: 1,
        pageSize: 20,
      },
    },
  })
  listAdmin(@Query() query: PaginationQuery) {
    return this.orderService.listForAdmin(query.page, query.pageSize, query.locale);
  }

  @Post('handle-order')
  @IsPublic()
  @HttpCode(200)
  @ApiOperation({ summary: 'Delivery service order status webhook' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  handleOrder(@Body() body: unknown) {
    this.orderService.handleDeliveryWebhook(body);
    return { ok: true };
  }
}
