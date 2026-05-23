import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from 'prisma/prisma.service';

@Controller('donations')
export class DonationsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService
  ) {}

  @Post('preference')
  async createDonationPreference(
    @Body() body: { creatorId: string; quantity: number; message?: string; donorName?: string; donorId?: string }
  ) {
    const { creatorId, quantity, message, donorName, donorId } = body;
    
    // Obtener el precio de la piña del creador
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new Error('Creador no encontrado');
    
    const amount = (creator.pinaPrice || 1000) * quantity;
    
    return this.paymentsService.createDonationPreference(
      creatorId,
      quantity,
      amount,
      message,
      donorName,
      donorId
    );
  }

  @Get('public/:creatorId')
  async getPublicDonations(@Param('creatorId') creatorId: string) {
    // Obtener últimas donaciones aprobadas para el perfil público
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
