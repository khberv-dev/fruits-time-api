import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '@/shared/entities/branch.entity';
import { BranchController } from '@/core/branch/branch.controller';
import { BranchService } from '@/core/branch/branch.service';
import { PosterModule } from '@/core/poster/poster.module';

@Module({
  imports: [TypeOrmModule.forFeature([Branch]), PosterModule],
  controllers: [BranchController],
  providers: [BranchService],
})
export class BranchModule {}
