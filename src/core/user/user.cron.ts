import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '@/shared/entities/user.entity';
import { PosterService } from '@/core/poster/poster.service';

@Injectable()
export class UserCron {
  private readonly logger = new Logger('User Cron');
  private running = false;

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly posterService: PosterService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncMissingPosIds() {
    if (this.running) return;
    this.running = true;

    try {
      const users = await this.userRepo.find({ where: { posId: IsNull() } });
      if (users.length === 0) return;

      this.logger.log(`Syncing ${users.length} user(s) to POS`);

      for (const user of users) {
        const posId = await this.posterService.createClient(user.firstName, user.phoneNumber);
        if (posId === null) continue;

        user.posId = posId;
        await this.userRepo.save(user);
      }
    } finally {
      this.running = false;
    }
  }
}
