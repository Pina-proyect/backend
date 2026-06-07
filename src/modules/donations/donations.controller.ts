import { Controller, Post, Body, Get, Param, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from 'prisma/prisma.service';
import { DonationPreferenceDto } from './dto/donation-preference.dto';

@Controller('donations')
export class DonationsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService
  ) {}

  @Post('preference')
  async createDonationPreference(
    @Body() body: DonationPreferenceDto,
  ) {
    const { creatorId, quantity, message, donorName, donorId } = body;

    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new BadRequestException('Creador no encontrado');

    if (!creator.mpAccessToken) {
      throw new BadRequestException(
        'Esta creadora todavía no conectó su cuenta de Mercado Pago. Pedile que vaya a Settings → Monetización y conecte su cuenta.',
      );
    }

    const amount = (creator.pinaPrice || 1000) * quantity;

    // 1) Crear Donation en estado pending ANTES de llamar a MP
    // Spec mp_agent.md 3.3.4: persistir la intención de donación primero.
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
      // 2) Crear preference en MP
      const preference = await this.paymentsService.createDonationPreference(
        creatorId,
        quantity,
        amount,
        message,
        donorName,
        donorId,
        donation.id,
      );

      // 3) Guardar preferenceId en la Donation
      await this.prisma.donation.update({
        where: { id: donation.id },
        data: {
          preferenceId: preference.id,
          preferenceCreatedAt: new Date(),
        },
      });

      return preference;
    } catch (error: any) {
      // 4) Si falla la preference, marcar Donation como failed
      // (no la borramos: queda como evidencia para debugging)
      await this.prisma.donation.update({
        where: { id: donation.id },
        data: { status: 'failed' },
      });
      console.error('[DONATIONS] Error creating preference:', error);
      throw new InternalServerErrorException(
        `Error al crear preferencia de donación: ${error?.message || 'unknown'}`,
      );
    }
  }

  @Get('public/:creatorId')
  async getPublicDonations(@Param('creatorId') creatorId: string) {
    return this.fetchApprovedDonations(creatorId);
  }

  /**
   * Spec-style path aligned to mp_agent.md 3.2:
   * GET /creators/:creatorId/donations
   * @deprecated use /donations/public/:creatorId OR this — same handler
   */
  @Get('creators/:creatorId/donations')
  async getCreatorDonationsSpec(@Param('creatorId') creatorId: string) {
    return this.fetchApprovedDonations(creatorId);
  }

  /**
   * Spec-style path aligned to mp_agent.md 3.3:
   * POST /payments/pinas — alias of /donations/preference
   * @deprecated both work
   */
  @Post('payments/pinas')
  async createPaymentPreferenceSpec(@Body() body: DonationPreferenceDto) {
    return this.createDonationPreference(body);
  }

  private async fetchApprovedDonations(creatorId: string) {
    const donations = await this.prisma.donation.findMany({
      where: { creatorId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        quantity: true,
        message: true,
        donorName: true,
        createdAt: true,
        donor: { select: { fullName: true, slug: true } }
      }
    });
    return donations;
  }
}
