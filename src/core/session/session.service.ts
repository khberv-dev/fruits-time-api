import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '@/shared/entities/session.entity';
import { User } from '@/shared/entities/user.entity';
import { UpsertSessionRequest } from '@/core/session/dto/upsert-session-request.dto';

@Injectable()
export class SessionService {
  constructor(@InjectRepository(Session) private readonly sessionRepo: Repository<Session>) {}

  async upsert(userId: string, data: UpsertSessionRequest): Promise<Session | null> {
    await this.sessionRepo.upsert(
      { user: { id: userId } as User, fcmToken: data.fcmToken, os: data.os },
      { conflictPaths: ['user'] },
    );
    return this.sessionRepo.findOne({ where: { user: { id: userId } } });
  }
}
