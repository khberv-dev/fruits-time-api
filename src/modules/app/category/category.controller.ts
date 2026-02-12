import { Controller, Get } from '@nestjs/common';
import { CategoryService } from '@/modules/app/category/category.service';
import { Public } from '@/common/decorators/public.decorator';

@Public()
@Controller('app/category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  getAll() {
    return this.categoryService.getAll();
  }
}
