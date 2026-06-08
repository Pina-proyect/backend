import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';

/**
 * Spec-style routes for creator payment settings:
 * - GET  /creators/me/payment-settings — Health check + MP account details
 * - POST /creators/me/mp/disconnect    — Unlink MP account
 * - POST /creators/me/mp/connect       — Get OAuth authorization URL
 */
@Controller('creators')
export class CreatorsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me/payment-settings')
  async getPaymentSettings(@Req() req: any) {
    const creatorId = req.user.id ?? req.user.sub;
    return this.paymentsService.getPaymentSettings(creatorId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/mp/disconnect')
  async disconnectMercadoPago(@Req() req: any) {
    const creatorId = req.user.id ?? req.user.sub;
    await this.paymentsService.disconnectMercadoPago(creatorId);
    return { isConnected: false, provider: 'mercadopago' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/mp/connect')
  async connectMercadoPago(@Req() req: any) {
    const creatorId = req.user.id ?? req.user.sub;
    const url = this.paymentsService.getMercadoPagoAuthUrl(creatorId);
    return { url };
  }
}
