import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { UserRole } from '@/shared/enums/user-role.enum';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  getUserInfo(userId: string) {
    return this.userRepo.findOne({
      where: {
        id: userId,
        role: UserRole.ADMIN,
      },
    });
  }
}
