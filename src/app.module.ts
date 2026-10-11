import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { AiModule } from './modules/ai/ai.module';
import { envValidationSchema } from './config/env.validation';

/** Driver de storage efectivo: STORAGE_DRIVER, default r2 en producción. */
function storageDriver(): 'local' | 'r2' {
  const explicit = process.env.STORAGE_DRIVER;
  if (explicit === 'local' || explicit === 'r2') return explicit;
  return process.env.NODE_ENV === 'production' ? 'r2' : 'local';
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
    }),
    ConfigModule.forRoot({
      // abortEarly:false por defecto en @nestjs/config → el error nombra TODAS
      // las R2_* faltantes con STORAGE_DRIVER=r2 (REQ-R2S-3).
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // ServeStatic solo en modo local (R2 privado no debe exponer /uploads).
    ...(storageDriver() === 'local'
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads',
          }),
        ]
      : []),
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
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
