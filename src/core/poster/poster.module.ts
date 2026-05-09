import { Module } from '@nestjs/common';
import { PosterService } from '@/core/poster/poster.service';

@Module({
  providers: [PosterService],
  exports: [PosterService],
})
export class PosterModule {}
