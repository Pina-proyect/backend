import { Controller, Post, Body, Get, Param, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from 'prisma/prisma.service';
import { DonationPreferenceDto } from '../donations/dto/donation-preference.dto';

/**
 * Spec-style routes aligned to mp_agent.md:
 * - POST /payments/pinas         (3.3) — donation creation
 * - GET  /creators/:creatorId/donations (3.2) — public donation list
 *
 * These are at root level (not under /donations) to match the spec.
 * The legacy /donations/preference and /donations/public/:id still work
 * via DonationsController and will be removed in v1.18.
 */
@Controller()
export class PinasController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService
  ) {}

  @Post('payments/pinas')
  async createPaymentPreference(@Body() body: DonationPreferenceDto) {
    const { creatorId, quantity, message, donorName, donorId } = body;

    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new BadRequestException('Creador no encontrado');

    if (!creator.mpAccessToken) {
      throw new BadRequestException(
        'Este creador aún no tiene configurada su cuenta de cobro en Mercado Pago.',
      );
    }

    const amount = (creator.pinaPrice || 1000) * quantity;

    const donation = await this.prisma.donation.create({
      data: {
        creatorId,
        quantity,
        amount,
        message: message || null,
        donorName: donorName || null,
        donorId: donorId || null,
        status: 'pending',
      },
    });

    try {
      const preference = await this.paymentsService.createDonationPreference(
        creatorId,
        quantity,
        amount,
        message,
        donorName,
        donorId,
        donation.id,
      );

      await this.prisma.donation.update({
        where: { id: donation.id },
        data: {
          preferenceId: preference.id,
          preferenceCreatedAt: new Date(),
        },
      });

      return preference;
    } catch (error: any) {
      await this.prisma.donation.update({
        where: { id: donation.id },
        data: { status: 'failed' },
      });
      console.error('[PINAS] Error creating preference:', error);
      throw new InternalServerErrorException(
        `Error al crear preferencia de donación: ${error?.message || 'unknown'}`,
      );
    }
  }

  @Get('creators/:creatorId/donations')
  async getCreatorDonations(@Param('creatorId') creatorId: string) {
    return this.prisma.donation.findMany({
      where: { creatorId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        quantity: true,
        message: true,
        donorName: true,
        createdAt: true,
        donor: { select: { fullName: true, slug: true } },
      },
    });
  }
}
