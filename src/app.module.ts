import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from 'prisma/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { StorageModule } from './modules/storage/storage.module';
import { MediaModule } from './modules/media/media.module';
import { PacksModule } from './modules/packs/packs.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DonationsModule } from './modules/donations/donations.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CacheModule } from './common/cache/cache.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        JWT_SECRET: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().required(),
        FRONTEND_URL: Joi.string().uri({ allowRelative: true }).required(),
        PORT: Joi.number().default(4011),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        BCRYPT_SALT_ROUNDS: Joi.number().default(10),
        MP_ACCESS_TOKEN: Joi.string().optional().allow(''),
        MP_CLIENT_ID: Joi.string().optional().allow(''),
        MP_CLIENT_SECRET: Joi.string().optional().allow(''),
        MP_REDIRECT_URI: Joi.string().optional().allow(''),
        MP_WEBHOOK_SECRET: Joi.string().optional().allow(''),
        NGROK_URL: Joi.string().optional().allow(''),
        BACKEND_URL: Joi.string().optional().allow(''),
        CORS_ORIGINS: Joi.string().optional().allow(''),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        REDIS_URL: Joi.string().uri().optional().allow(''),
        RESEND_API_KEY: Joi.string().optional().allow(''),
        EMAIL_FROM: Joi.string().optional().allow(''),
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    HealthModule,
    UsersModule,
    StorageModule,
    MediaModule,
    PacksModule,
    PaymentsModule,
    DonationsModule,
    NotificationModule,
    AnalyticsModule,
    CacheModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
