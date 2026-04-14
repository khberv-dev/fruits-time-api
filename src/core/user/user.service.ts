import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { UserRole } from '@/shared/enums/user-role.enum';

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

    const [rawUsersList, totalCount] = await this.userRepo.findAndCount({
      where: {
        role: UserRole.USER,
      },
      order: {
        createdAt: 'desc',
      },
      skip: offset,
      take: pageSize,
    });

    const users = rawUsersList.map((user) => {
      const { password, ...userData } = user;

      return userData;
    });

    return {
      users,
      total: totalCount,
      pages: Math.ceil(totalCount / pageSize),
    };
  }
}
