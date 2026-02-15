import { Body, Controller, Get, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { fileInterceptor } from '@/common/interceptors/file.interceptor';
import { CategoryService } from '@/modules/web/category/category.service';
import { CreateCategoryRequest } from '@/modules/web/category/dto/create-category-request.dto';
import { Public } from '@/common/decorators/public.decorator';
import { UpdateCategoryRequest } from '@/modules/web/category/dto/update-category-request.dto';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  getAll() {
    return this.categoryService.getAll();
  }

  @Post('create')
  @UseInterceptors(fileInterceptor('category'))
  create(@Body() body: CreateCategoryRequest, @UploadedFile() file: Express.Multer.File) {
    return this.categoryService.create(file.filename, body);
  }

  @Put(':id')
  update(@Param('id') categoryId: string, @Body() body: UpdateCategoryRequest) {
    return this.categoryService.update(categoryId, body);
  }
}
