import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/shared/entities/user.entity';
import { IsNull, Repository } from 'typeorm';
import { UserRole } from '@/shared/enums/user-role.enum';
import { UpdateUserRequest } from '@/core/user/dto/update-user-request.dto';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { generateReferralCode } from '@/shared/utils/lib';
import { UserStatus } from '@/shared/enums/user-status.enum';
import { PosterService } from '@/core/poster/poster.service';

dayjs.extend(customParseFormat);

const STATUS_TIERS: { status: UserStatus; minReferrals: number; discountPercent: number }[] = [
  { status: UserStatus.SILVER, minReferrals: 0, discountPercent: 0 },
  { status: UserStatus.GOLD, minReferrals: 1, discountPercent: 3 },
  { status: UserStatus.VIP, minReferrals: 6, discountPercent: 7 },
  { status: UserStatus.PREMIUM, minReferrals: 11, discountPercent: 12 },
];

export function computeUserStatus(referralCount: number): UserStatus {
  return getTier(referralCount).status;
}

export function getStatusDiscount(status: UserStatus): number {
  return STATUS_TIERS.find((tier) => tier.status === status)?.discountPercent ?? 0;
}

export function computeStatusProgress(referralCount: number) {
  const currentIndex = STATUS_TIERS.findIndex((tier) => tier.status === getTier(referralCount).status);
  const current = STATUS_TIERS[currentIndex];
  const next = STATUS_TIERS[currentIndex + 1];

  return {
    status: current.status,
    discountPercent: current.discountPercent,
    nextStatus: next?.status ?? null,
    nextDiscountPercent: next?.discountPercent ?? null,
    remaining: next ? next.minReferrals - referralCount : 0,
  };
}

function getTier(referralCount: number) {
  let match = STATUS_TIERS[0];
  for (const tier of STATUS_TIERS) {
    if (referralCount >= tier.minReferrals) match = tier;
  }
  return match;
}

@Injectable()
export class UserService implements OnApplicationBootstrap {
  private readonly logger = new Logger('User Service');

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly posterService: PosterService,
  ) {}

  onApplicationBootstrap() {
    void this.syncMissingPosIds();
  }

  async syncMissingPosIds() {
    const users = await this.userRepo.find({ where: { posId: IsNull() } });
    if (users.length === 0) return;

    this.logger.log(`Syncing ${users.length} user(s) to POS`);

    for (const user of users) {
      const posId = await this.posterService.createClient(user.firstName, user.phoneNumber);
      if (posId !== null) {
        user.posId = posId;
        await this.userRepo.save(user);
        this.logger.log(`Synced ${user.firstName} (${user.phoneNumber}) → posId=${posId}`);
      } else {
        this.logger.warn(`Unable sync ${user.firstName} (${user.phoneNumber})`);
      }
    }
  }

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
    const status = computeUserStatus(referralCount);

    return {
      ...userData,
      referralCount,
      status,
      discountPercent: getStatusDiscount(status),
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
