import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Branch } from '@/shared/entities/branch.entity';
import { PosterService } from '@/core/poster/poster.service';
import { UpdateBranchRequest } from '@/core/branch/dto/update-branch-request.dto';

@Injectable()
export class BranchService {
  private readonly logger = new Logger(BranchService.name);

  constructor(
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    private readonly posterService: PosterService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sync(): Promise<Branch[]> {
    const spots = await this.posterService.getSpots();

    if (!spots.length) {
      this.logger.warn('sync: no spots returned from POS');
      return this.list();
    }

    for (const spot of spots) {
      await this.branchRepo.upsert(
        { posId: spot.spot_id, name: spot.name, address: spot.address },
        { conflictPaths: ['posId'] },
      );
    }

    this.logger.log(`sync: upserted ${spots.length} branches`);
    return this.list();
  }

  getStorages() {
    return this.posterService.getStorages();
  }

  list(): Promise<Branch[]> {
    return this.branchRepo.find({ where: { isActive: true }, order: { posId: 'ASC' } });
  }

  async update(id: string, data: UpdateBranchRequest): Promise<Branch> {
    const branch = await this.branchRepo.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Filial topilmadi');
    }

    if (data.long !== undefined) branch.long = data.long;
    if (data.lat !== undefined) branch.lat = data.lat;
    if (data.storageId !== undefined) branch.storageId = data.storageId;
    if (data.managerName !== undefined) branch.managerName = data.managerName;
    if (data.managerPhone !== undefined) branch.managerPhone = data.managerPhone;
    if (data.isWorking !== undefined) branch.isWorking = data.isWorking;

    return this.branchRepo.save(branch);
  }
}
