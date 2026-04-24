import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { UserRole } from '@/shared/enums/user-role.enum';
import { UpdateUserRequest } from '@/core/user/dto/update-user-request.dto';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

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

    const [rawUsersList, usersCount] = await this.userRepo.findAndCount({
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
      total: usersCount,
      pages: Math.ceil(usersCount / pageSize),
    };
  }

  async update(userId: string, data: UpdateUserRequest) {
    const user = await this.userRepo.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException();
    }

    if (data.birthday) {
      user.birthday = dayjs(data.birthday, 'DD-MM-YYYY').toDate();
    }

    if (data.weight) {
      user.weight = data.weight;
    }

    if (data.height) {
      user.height = data.height;
    }

    if (data.gender) {
      user.gender = data.gender;
    }

    return this.userRepo.save(user);
  }
}
