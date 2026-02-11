import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { UpdateUserRequest } from '@/modules/app/user/dto/update-user-request.dto';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  getUserInfo(userId: string) {
    return this.userRepo.findOne({
      where: {
        id: userId,
      },
    });
  }

  async updateUserInfo(userId: string, data: UpdateUserRequest) {
    const user = await this.userRepo.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    const userWithPhoneNumber = await this.userRepo.findOne({
      where: {
        phoneNumber: data.phoneNumber,
      },
    });

    if (!userWithPhoneNumber || user.phoneNumber === data.phoneNumber) {
      await this.userRepo.update(userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
      });

      return {
        message: 'Profil yangilandi',
      };
    }

    throw new BadRequestException('Boshqa raqam kiriting');
  }
}
