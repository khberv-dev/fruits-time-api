import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  async findById(userId: string) {
    const user = await this.userRepo.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const { password, ...userData } = user;

    return userData;
  }

  async findAllPaginate(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;

    const users = await this.userRepo.find({
      order: {
        createdAt: 'desc',
      },
      skip: offset,
      take: pageSize,
    });

    const totalCount = await this.userRepo.count();

    return {
      users,
      total: totalCount,
      pages: Math.round(totalCount / pageSize),
    };
  }
}
