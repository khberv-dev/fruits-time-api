import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AddressService } from '@/core/address/address.service';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { CreateAddressRequest } from '@/core/address/dto/create-address-request.dto';

const addressExample = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Uy',
  long: 69.2401,
  lat: 41.2995,
  createdAt: '2025-05-04T10:15:00.000Z',
  updatedAt: '2025-05-04T10:15:00.000Z',
};

@ApiTags('Address')
@ApiBearerAuth('access-token')
@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's saved addresses (newest first)" })
  @ApiOkResponse({ description: 'Saved addresses', schema: { example: [addressExample] } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  list(@RequestUser() user: ReqUser) {
    return this.addressService.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new address for the authenticated user' })
  @ApiCreatedResponse({ description: 'Address created', schema: { example: addressExample } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  create(@RequestUser() user: ReqUser, @Body() body: CreateAddressRequest) {
    return this.addressService.create(user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Delete one of the authenticated user's addresses" })
  @ApiOkResponse({ schema: { example: { message: "Manzil o'chirildi" } } })
  @ApiNotFoundResponse({ description: 'Address not found or not owned by the caller' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  remove(@RequestUser() user: ReqUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.addressService.remove(user.id, id);
  }
}
