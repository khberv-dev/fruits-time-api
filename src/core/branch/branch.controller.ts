import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BranchService } from '@/core/branch/branch.service';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { Role } from '@/common/decorators/role.decorator';
import { UserRole } from '@/shared/enums/user-role.enum';

const branchExample = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    posId: 1,
    name: 'Fruits Time 1',
    address: 'Tashkent, Yunusobod 4',
    isActive: true,
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    posId: 2,
    name: 'Fruits Time 2',
    address: 'Tashkent, Chilonzor 7',
    isActive: true,
  },
];

@ApiTags('Branch')
@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @IsPublic()
  @ApiOperation({ summary: 'List all active branches' })
  @ApiOkResponse({ schema: { example: branchExample } })
  list() {
    return this.branchService.list();
  }

  @Post('sync')
  @Role(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sync branches from POS (admin only)' })
  @ApiOkResponse({ description: 'Updated branch list after sync', schema: { example: branchExample } })
  sync() {
    return this.branchService.sync();
  }
}
