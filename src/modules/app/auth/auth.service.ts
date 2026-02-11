import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, validatePassword } from '@/utils/hash.util';
import { SignInRequest } from './dto/sign-in-request.dto';
import { SendOtpRequest } from './dto/send-otp-request.dto';
import { Otp } from '@/shared/entities/otp.entity';
import { VerifyOtpRequest } from './dto/verify-otp-request.dto';
import { RegisterUserRequest } from './dto/register-user-request.dto';
import { UserRole } from '@/shared/enums/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Otp) private readonly otpRepository: Repository<Otp>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(phoneNumber: string, password: string) {
    const user = await this.userRepo.findOne({
      where: {
        phoneNumber,
        role: UserRole.USER,
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

  async sendOtp(data: SendOtpRequest) {
    // const code = randomOTP();
    const code = '666666';
    const otp = await this.otpRepository.save({
      phoneNumber: data.phoneNumber,
      code,
    });

    return {
      message: 'SMS kod yuborildi',
      sessionId: otp.id,
    };
  }

  async verifyOtp(data: VerifyOtpRequest) {
    const otp = await this.otpRepository.findOne({
      where: {
        id: data.sessionId,
        verifiedAt: IsNull(),
      },
    });

    if (!otp || otp.code !== data.code) {
      throw new BadRequestException('Xato SMS kod');
    }

    await this.otpRepository.update(data.sessionId, {
      verifiedAt: new Date(),
    });

    return {
      message: 'OK',
    };
  }

  async register(data: RegisterUserRequest) {
    const otp = await this.otpRepository.findOne({
      where: {
        id: data.otpSession,
      },
    });

    if (!otp || !otp.verifiedAt) {
      throw new BadRequestException('Raqam tasdiqlanmagan');
    }

    const passwordHash = await hashPassword(data.password);

    await this.userRepo.save({
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: otp.phoneNumber,
      password: passwordHash,
    });

    return {
      message: 'OK',
    };
  }

  async checkPhoneNumber(phoneNumber: string) {
    const user = await this.userRepo.findOne({
      where: {
        phoneNumber,
        role: UserRole.USER,
      },
    });

    if (!user) {
      return {
        ok: false,
      };
    }

    return {
      ok: true,
    };
  }
}
