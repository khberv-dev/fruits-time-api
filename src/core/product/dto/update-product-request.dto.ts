import { PartialType } from '@nestjs/mapped-types';
import { CreateProductRequest } from '@/core/product/dto/create-product-request.dto';

export class UpdateProductRequest extends PartialType(CreateProductRequest) {}
