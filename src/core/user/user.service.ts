import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { AuthService } from '@/core/auth/auth.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly authService: AuthService,
  ) {}

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
}
