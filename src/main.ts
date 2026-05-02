import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { validationPipe } from '@/common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new Logger('App');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  app.useGlobalPipes(validationPipe);
  app.enableCors();
  app.setGlobalPrefix('api');

  const docConfig = new DocumentBuilder()
    .setTitle('Fruits Time API')
    .setDescription(
      'Backend for the Fruits Time mobile and admin apps. ' +
        'All endpoints listed below are mounted under the `/api` prefix. ' +
        'Authenticate with the `Authorization: Bearer <accessToken>` header — ' +
        'tokens are obtained from `POST /auth/sign-in` or `POST /auth/sign-up`.',
    )
    .setVersion('1.0')
    .addServer('/api')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'access-token')
    .addTag('Auth', 'Sign-up, sign-in, token refresh, OTP verification')
    .addTag('User', 'Authenticated profile + admin user listing')
    .addTag('Catalog', 'Product catalogs (admin CRUD, public read)')
    .addTag('Product', 'Products inside a catalog (admin CRUD, public read + search)')
    .addTag('Banner', 'Marketing banners (admin write, public read)')
    .addTag('Stats', 'Admin dashboard summaries and trend series')
    .addTag('Assistant', 'AI nutritionist chat')
    .build();

  const document = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  logger.log(`Listening on :${port}`);
  logger.log(`Swagger running on /docs`);
}

bootstrap();
