import { Controller, Post, Body, Req, UseGuards, Query, Get, Res, Headers, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('create-preference')
  async createPreference(@Body('packId') packId: string, @Req() req: any) {
    const userId = req.user.id ?? req.user.sub;
    return this.paymentsService.createPreference(packId, userId);
  }

  @Post('webhook')
  async webhook(
    @Query('topic') topic: string,
    @Query('id') id: string,
    @Query('creatorId') creatorId: string,
    @Body() body: any,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
  ) {
    if (!this.paymentsService.validateWebhookSignature(xSignature || '', xRequestId || '')) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const finalId = id || body?.data?.id;
    const finalTopic = topic || body?.type;

    return this.paymentsService.handleWebhook(finalTopic, finalId, creatorId);
  }

  @Get('mercadopago/auth')
  async mercadopagoAuth(@Query('creatorId') creatorId: string, @Res() res: Response) {
    const url = this.paymentsService.getMercadoPagoAuthUrl(creatorId);
    return res.redirect(url);
  }

  @Get('mercadopago/callback')
  async mercadopagoCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response
  ) {
    const redirectUrl = await this.paymentsService.handleMercadoPagoCallback(code, state);
    return res.redirect(redirectUrl);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mercadopago/disconnect')
  async mercadopagoDisconnect(@Req() req: any) {
    const creatorId = req.user.id ?? req.user.sub;
    return this.paymentsService.disconnectMercadoPago(creatorId);
  }
}
