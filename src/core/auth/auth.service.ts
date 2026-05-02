import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@/shared/enums/user-role.enum';
import { ConfigService } from '@nestjs/config';
import { CreateUserRequest } from '@/core/auth/dto/create-user-request.dto';
import { encryptPassword, generateReferralCode, randomOTP, validatePassword } from '@/shared/utils/lib';
import { SignInRequest } from '@/core/auth/dto/sign-in-request.dto';
import { SendOtpRequest } from '@/core/auth/dto/send-otp-request.dto';
import { Otp } from '@/shared/entities/otp.entity';
import { VerifyOtpRequest } from '@/core/auth/dto/verify-otp-request.dto';
import dayjs from 'dayjs';
import { SmsService } from '@/core/notify/sms.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Otp) private readonly otpRepo: Repository<Otp>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly smsService: SmsService,
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

  private async generateUniqueReferralCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateReferralCode();
      const exists = await this.userRepo.exists({ where: { referralCode: code } });
      if (!exists) return code;
    }
    throw new InternalServerErrorException('Failed to generate unique referral code');
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

    let referredBy: User | undefined;
    if (data.referralCode) {
      const referrer = await this.userRepo.findOne({ where: { referralCode: data.referralCode } });
      if (!referrer) {
        throw new BadRequestException('Referal kod xato');
      }
      referredBy = referrer;
    }

    const passwordHash = await encryptPassword(data.password);
    const referralCode = await this.generateUniqueReferralCode();

    const user = await this.userRepo.save({
      firstName: data.firstName,
      phoneNumber: data.phoneNumber,
      password: passwordHash,
      role: UserRole.USER,
      referralCode,
      referredBy,
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

  checkPhoneNumber(phoneNumber: string) {
    return this.userRepo.exists({
      where: {
        phoneNumber,
      },
    });
  }

  async sendOtp(data: SendOtpRequest) {
    const code = randomOTP();

    await this.smsService.sendOTP(code, data.phoneNumber);
    return this.otpRepo.save({
      phoneNumber: data.phoneNumber,
      code: code,
      expiresAt: dayjs().add(15, 'minutes'),
    });
  }

  async verifyOtp(otpId: string, data: VerifyOtpRequest) {
    const now = dayjs();
    const otp = await this.otpRepo.findOne({
      where: {
        id: otpId,
      },
    });

    if (!otp || dayjs(otp.expiresAt).isAfter(now) || otp.attempts > 3) {
      throw new BadRequestException('Wrong session ID');
    }

    const isCodeValid = otp.code === data.code;

    if (!isCodeValid) {
      otp.attempts--;
      await this.otpRepo.save(otp);

      throw new BadRequestException('SMS kod xato');
    }

    otp.verifiedAt = now.toDate();

    await this.otpRepo.save(otp);
  }
}
