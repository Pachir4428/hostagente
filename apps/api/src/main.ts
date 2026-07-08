import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  // Larger JSON bodies so white-label logo/favicon data URIs fit.
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));

  // Reflect the requesting origin so the panel works whether it's served from
  // localhost, an IP (http://SEU_IP:3001) or a domain — no exact FRONTEND_URL
  // match needed. Auth is Bearer-token based and the refresh cookie is
  // SameSite=lax, so reflecting the origin is safe for this setup.
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('HostAgente API')
    .setDescription('Plataforma de revenda com deteção de pagamentos (MacroDroid)')
    .setVersion(process.env.APP_VERSION || '1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000, '0.0.0.0');
  console.log(`API running on port 3000`);
}

bootstrap();
