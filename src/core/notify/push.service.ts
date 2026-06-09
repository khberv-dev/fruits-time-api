import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const serviceAccount = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccount) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
      return;
    }

    try {
      this.app = initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    } catch (error) {
      this.logger.error(`Firebase init failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async send(fcmToken: string, title: string, body: string): Promise<void> {
    if (!this.app) return;

    try {
      await getMessaging(this.app).send({ token: fcmToken, notification: { title, body } });
    } catch (error) {
      this.logger.error(`Push send failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
