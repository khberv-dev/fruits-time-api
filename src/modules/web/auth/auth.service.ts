import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@/shared/enums/user-role.enum';
import { validatePassword } from '@/utils/hash.util';
import { SignInRequest } from '@/modules/app/auth/dto/sign-in-request.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(phoneNumber: string, password: string) {
    const user = await this.userRepo.findOne({
      where: {
        phoneNumber,
        role: UserRole.ADMIN,
      },
      select: ['id', 'firstName', 'lastName', 'phoneNumber', 'birthday', 'role', 'password'],
    });

    if (!user) {
      return null;
    }

    const isValidPassword = await validatePassword(password, user.password);

    return isValidPassword ? user : null;
  }

  async signIn(data: SignInRequest) {
    const userData = await this.validateUser(data.phoneNumber, data.password);

    if (!userData) {
      throw new BadRequestException('Parol xato');
    }

    const token = this.jwtService.sign({
      sub: userData.id,
      role: userData.role,
    });

    return {
      token,
      user: userData,
    };
  }
}
