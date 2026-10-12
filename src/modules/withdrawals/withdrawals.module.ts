import { Module } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationModule } from '../notifications/notification.module';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsAdminController } from './withdrawals-admin.controller';
import { WithdrawalsAdminGuard } from './guards/withdrawals-admin.guard';

/**
 * Módulo de retiros de creadoras (v1.27, HU4.2). Expone las rutas de creadora
 * (JWT) y la ruta administrativa (token de entorno), y reutiliza
 * `NotificationService` para las notificaciones in-app (REQ-WD-5).
 */
@Module({
  imports: [NotificationModule],
  controllers: [WithdrawalsController, WithdrawalsAdminController],
  providers: [WithdrawalsService, WithdrawalsAdminGuard, PrismaService],
})
export class WithdrawalsModule {}
