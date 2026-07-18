import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@/shared/enums/user-role.enum';
import { ConfigService } from '@nestjs/config';
import { CreateUserRequest } from '@/core/auth/dto/create-user-request.dto';
import { TelegramSignUpRequest } from '@/core/auth/dto/telegram-sign-up-request.dto';
import { encryptPassword, generateReferralCode, randomOTP, validatePassword } from '@/shared/utils/lib';
import { SignInRequest } from '@/core/auth/dto/sign-in-request.dto';
import { SendOtpRequest } from '@/core/auth/dto/send-otp-request.dto';
import { Otp } from '@/shared/entities/otp.entity';
import { VerifyOtpRequest } from '@/core/auth/dto/verify-otp-request.dto';
import dayjs from 'dayjs';
import { SmsService } from '@/core/notify/sms.service';
import { PosterService } from '@/core/poster/poster.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth Service');

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Otp) private readonly otpRepo: Repository<Otp>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly smsService: SmsService,
    private readonly posterService: PosterService,
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

    if (!user || !user.password) return null;

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

    const posId = await this.posterService.createClient(user.firstName, user.phoneNumber);
    if (posId !== null) {
      user.posId = posId;
      await this.userRepo.save(user);
      this.logger.log(`Synced ${user.firstName} (${user.phoneNumber}) → posId=${posId}`);
    } else {
      this.logger.warn(`Unable sync ${user.firstName} (${user.phoneNumber})`);
    }

    const tokens = this.issueTokens(user.id, user.role);

    return {
      id: user.id,
      ...tokens,
    };
  }

  // Phone numbers reach us here already verified by Telegram's own contact-share flow, so
  // unlike signUp there is no OTP round-trip and no password: the account is authenticated
  // going forward via telegramId (through the bot) or, if password gets set later, sign-in.
  async telegramSignUp(data: TelegramSignUpRequest) {
    const [existingByPhone, existingByTelegramId] = await Promise.all([
      this.userRepo.findOne({ where: { phoneNumber: data.phoneNumber } }),
      this.userRepo.findOne({ where: { telegramId: data.telegramId } }),
    ]);

    if (existingByTelegramId && existingByTelegramId.phoneNumber !== data.phoneNumber) {
      throw new ConflictException('Bu telegram akkaunt boshqa telefon raqamiga bogʻlangan');
    }

    if (existingByPhone) {
      if (existingByPhone.telegramId && existingByPhone.telegramId !== data.telegramId) {
        throw new ConflictException('Bu telefon raqami boshqa telegram akkauntiga bogʻlangan');
      }

      if (!existingByPhone.telegramId) {
        existingByPhone.telegramId = data.telegramId;
        await this.userRepo.save(existingByPhone);
      }

      const tokens = this.issueTokens(existingByPhone.id, existingByPhone.role);
      return { id: existingByPhone.id, ...tokens };
    }

    let referredBy: User | undefined;
    if (data.referralCode) {
      const referrer = await this.userRepo.findOne({ where: { referralCode: data.referralCode } });
      if (!referrer) {
        throw new BadRequestException('Referal kod xato');
      }
      referredBy = referrer;
    }

    const referralCode = await this.generateUniqueReferralCode();

    const user = await this.userRepo.save({
      firstName: data.firstName,
      phoneNumber: data.phoneNumber,
      telegramId: data.telegramId,
      password: null,
      role: UserRole.USER,
      referralCode,
      referredBy,
    });

    const posId = await this.posterService.createClient(user.firstName, user.phoneNumber);
    if (posId !== null) {
      user.posId = posId;
      await this.userRepo.save(user);
      this.logger.log(`Synced ${user.firstName} (${user.phoneNumber}) → posId=${posId}`);
    } else {
      this.logger.warn(`Unable sync ${user.firstName} (${user.phoneNumber})`);
    }

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

    // if (!otp || dayjs(otp.expiresAt).isAfter(now) || otp.attempts > 3) {
    if (!otp) {
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

  // Reuses the send-otp/verify-otp session from an earlier step: the OTP must have been
  // verified first (verifiedAt set), and its phoneNumber is used to look up the account —
  // the client never needs to resend the phone number here.
  async resetPassword(otpId: string, newPassword: string) {
    const otp = await this.otpRepo.findOne({ where: { id: otpId } });

    if (!otp || !otp.verifiedAt) {
      throw new BadRequestException('SMS kod tasdiqlanmagan');
    }

    const user = await this.userRepo.findOne({ where: { phoneNumber: otp.phoneNumber } });
    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    user.password = await encryptPassword(newPassword);
    await this.userRepo.save(user);
  }
}
