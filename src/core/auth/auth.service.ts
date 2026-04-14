import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@/shared/enums/user-role.enum';
import { ConfigService } from '@nestjs/config';
import { CreateUserRequest } from '@/core/auth/dto/create-user-request.dto';
import { encryptPassword, validatePassword } from '@/shared/utils/lib';
import { SignInRequest } from '@/core/auth/dto/sign-in-request.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private issueTokens(userId: string, role: UserRole) {
    const payload = {
      sub: userId,
      role,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow('JWT_REFRESH_EXPIRE'),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async validateUser(phoneNumber: string, password: string) {
    const user = await this.userRepo.findOne({
      where: {
        phoneNumber,
      },
    });

    if (!user) return null;

    const isValidPassword = await validatePassword(password, user.password);

    return isValidPassword ? user : null;
  }

  async signUp(data: CreateUserRequest) {
    const existingUser = await this.userRepo.exists({
      where: {
        phoneNumber: data.phoneNumber,
      },
    });

    if (existingUser) {
      throw new ConflictException('Boshqa telefon raqam kiriting');
    }

    const passwordHash = await encryptPassword(data.password);

    const user = await this.userRepo.save({
      firstName: data.firstName,
      phoneNumber: data.phoneNumber,
      password: passwordHash,
      role: UserRole.USER,
    });

    const tokens = this.issueTokens(user.id, user.role);

    return {
      id: user.id,
      ...tokens,
    };
  }

  async signIn(data: SignInRequest) {
    const validatedUser = await this.validateUser(data.phoneNumber, data.password);

    if (!validatedUser) {
      throw new BadRequestException('Telefon raqam yoki parol xato kiritildi');
    }

    return this.issueTokens(validatedUser.id, validatedUser.role);
  }

  refreshTokens(userId: string, role: UserRole) {
    return this.issueTokens(userId, role);
  }
}
