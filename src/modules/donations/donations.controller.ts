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

    try {
      return await this.paymentsService.createDonationPreference(
        creatorId,
        quantity,
        amount,
        message,
        donorName,
        donorId
      );
    } catch (error: any) {
      console.error('[DONATIONS] Error creating preference:', error);
      throw new InternalServerErrorException(
        `Error al crear preferencia de donación: ${error?.message || 'unknown'}`,
      );
    }
  }

  @Get('public/:creatorId')
  async getPublicDonations(@Param('creatorId') creatorId: string) {
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
