import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { Catalog } from '@/shared/entities/catalog.entity';
import { Product } from '@/shared/entities/product.entity';
import { UserRole } from '@/shared/enums/user-role.enum';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Catalog) private readonly catalogRepo: Repository<Catalog>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async getSummary() {
    const userCount = await this.userRepo.count({
      where: {
        role: UserRole.USER,
      },
    });

    const catalogCount = await this.catalogRepo.count();
    const productCount = await this.productRepo.count();

    return {
      userCount,
      catalogCount,
      productCount,
    };
  }
}
