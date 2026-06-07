import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PinasController } from './pinas.controller';
import { WebhooksController } from './webhooks.controller';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [PaymentsController, PinasController, WebhooksController],
  providers: [PaymentsService, PrismaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
