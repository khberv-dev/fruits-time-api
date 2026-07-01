import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PromotionService } from '@/core/promotion/promotion.service';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';
import { UpdatePromotionRequest } from '@/core/promotion/dto/update-promotion-request.dto';

const promotionExample = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  type: 'first_order_first_item',
  isActive: true,
  createdAt: '2025-06-01T00:00:00.000Z',
  updatedAt: '2025-06-01T00:00:00.000Z',
};

@ApiTags('Promotion')
@Controller('promotion')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get()
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all promotions (admin only)' })
  @ApiOkResponse({ description: 'All promotions', schema: { example: [promotionExample] } })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  list() {
    return this.promotionService.findAll();
  }

  @Patch(':id')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Enable or disable a promotion (admin only)' })
  @ApiOkResponse({ description: 'Updated promotion', schema: { example: promotionExample } })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePromotionRequest) {
    return this.promotionService.setActive(id, body.isActive);
  }
}
