import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Query,
  Get,
  Res,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('create-preference')
  async createPreference(
    @Body('packId') packId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.paymentsService.createPreference(packId, userId);
  }

  @Post('webhook')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async webhook(
    @Query('topic') topic: string,
    @Query('id') id: string,
    @Query('data.id') dataId: string,
    @Query('creatorId') creatorId: string,
    @Body() body: WebhookPayloadDto,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
  ) {
    const finalDataId = dataId || id || (body?.data?.id as string) || '';
    const finalId = dataId || id || (body?.data?.id as string) || '';

    if (
      !this.paymentsService.validateWebhookSignature(
        xSignature || '',
        xRequestId || '',
        finalDataId,
      )
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const finalTopic = topic || body?.type || '';

    return this.paymentsService.handleWebhook(finalTopic, finalId, creatorId);
  }

  @Get('mercadopago/auth')
  mercadopagoAuth(@Query('creatorId') creatorId: string, @Res() res: Response) {
    try {
      const url = this.paymentsService.getMercadoPagoAuthUrl(creatorId);
      return res.redirect(url);
    } catch (error: unknown) {
      console.error(
        '[MP OAUTH] Error generando URL:',
        error instanceof Error ? error.message : error,
      );
      const frontendUrl =
        process.env.FRONTEND_URL || 'https://pina-delta.vercel.app';
      const msg = encodeURIComponent(
        error instanceof Error ? error.message : 'oauth_config_missing',
      );
      return res.redirect(
        `${frontendUrl}/settings?tab=monetization&connected=error&message=${msg}`,
      );
    }
  }

  @Get('mercadopago/callback')
  async mercadopagoCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.paymentsService.handleMercadoPagoCallback(
      code,
      state,
    );
    return res.redirect(redirectUrl);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mercadopago/disconnect')
  async mercadopagoDisconnect(@Req() req: AuthenticatedRequest) {
    const creatorId = req.user.id;
    return this.paymentsService.disconnectMercadoPago(creatorId);
  }
}
