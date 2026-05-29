import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Habilitamos lectura de cookies (req.cookies) para usar refresh tokens HttpOnly
  // En tests, NestFactory.create está mockeado y puede no exponer `use`.
  if ((app as any).use) {
    app.use(cookieParser());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/pina');

  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
