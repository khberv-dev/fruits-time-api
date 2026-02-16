import { Body, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ProductService } from '@/modules/web/product/product.service';
import { CreateProductRequest } from '@/modules/web/product/dto/create-product-request.dto';
import { fileInterceptor } from '@/common/interceptors/file.interceptor';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  getByCategory(@Query('category') categoryId: string) {
    return this.productService.get(categoryId);
  }

  @Post('create')
  @UseInterceptors(fileInterceptor('product'))
  create(@Body() body: CreateProductRequest, @UploadedFile() file: Express.Multer.File) {
    return this.productService.create(file.filename, body);
  }
}
