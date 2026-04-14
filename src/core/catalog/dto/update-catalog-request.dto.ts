import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogRequest } from '@/core/catalog/dto/create-catalog-request.dto';

export class UpdateCatalogRequest extends PartialType(CreateCatalogRequest) {}
