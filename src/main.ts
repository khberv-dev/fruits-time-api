import { NestFactory } from '@nestjs/core';
import { AppModule } from './core/app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new Logger('App');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  app.enableCors();
  app.useGlobalPipes(validationPipe);
  await app.listen(port);
  logger.log(`Listening on :${port}`);
}

bootstrap();
