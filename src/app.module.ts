import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // ConfigModule global para leer variables de entorno en toda la app
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
