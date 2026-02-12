import { Controller, Get, Query } from '@nestjs/common';
import { ProductService } from '@/modules/app/product/product.service';
import { Public } from '@/common/decorators/public.decorator';

@Public()
@Controller('app/product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  getByCategory(@Query('category') categoryId: string) {
    return this.productService.getByCategory(categoryId);
  }
}
