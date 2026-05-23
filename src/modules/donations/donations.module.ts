import { Module } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { DonationsController } from './donations.controller';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaService } from '../../../prisma/prisma.service';

@Module({
  imports: [PaymentsModule],
  providers: [DonationsService, PrismaService],
  controllers: [DonationsController],
  exports: [DonationsService],
})
export class DonationsModule {}
