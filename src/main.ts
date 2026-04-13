import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('App');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  app.enableCors();
  app.setGlobalPrefix('api');

  await app.listen(port);
  logger.log(`Listening on :${port}`);
}

bootstrap();
