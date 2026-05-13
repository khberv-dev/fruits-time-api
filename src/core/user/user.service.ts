import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { Repository } from 'typeorm';
import { UserRole } from '@/shared/enums/user-role.enum';
import { UpdateUserRequest } from '@/core/user/dto/update-user-request.dto';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { generateReferralCode } from '@/shared/utils/lib';
import { UserStatus } from '@/shared/enums/user-status.enum';

dayjs.extend(customParseFormat);

export function computeUserStatus(referralCount: number): UserStatus {
  if (referralCount > 10) return UserStatus.PREMIUM;
  if (referralCount > 5) return UserStatus.VIP;
  if (referralCount >= 1) return UserStatus.GOLD;
  return UserStatus.SILVER;
}

export function computeStatusProgress(referralCount: number) {
  const status = computeUserStatus(referralCount);
  if (status === UserStatus.SILVER) {
    return { status, nextStatus: UserStatus.GOLD, remaining: 1 - referralCount };
  }
  if (status === UserStatus.GOLD) {
    return { status, nextStatus: UserStatus.VIP, remaining: 6 - referralCount };
  }
  if (status === UserStatus.VIP) {
    return { status, nextStatus: UserStatus.PREMIUM, remaining: 11 - referralCount };
  }
  return { status, nextStatus: null, remaining: 0 };
}

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

    const referralCount = await this.userRepo.count({
      where: { referredBy: { id: userId } },
    });

    const { password, ...userData } = user;

    return {
      ...userData,
      referralCount,
      status: computeUserStatus(referralCount),
    };
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

  async getReferral(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    if (!user.referralCode) {
      user.referralCode = await this.generateUniqueReferralCode();
      await this.userRepo.save(user);
    }

    const count = await this.userRepo.count({
      where: { referredBy: { id: userId } },
    });

    return { code: user.referralCode, count, ...computeStatusProgress(count) };
  }

  private async generateUniqueReferralCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateReferralCode();
      const exists = await this.userRepo.exists({ where: { referralCode: code } });
      if (!exists) return code;
    }
    throw new InternalServerErrorException('Failed to generate unique referral code');
  }
}
