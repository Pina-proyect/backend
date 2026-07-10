import {
  Controller,
  Post,
  Query,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

/**
 * Webhook de Mercado Pago alineado al spec mp_agent.md 3.4:
 * POST /webhooks/mercadopago
 *
 * El path legacy /payments/webhook (payments.controller.ts) se mantiene
 * como alias durante v1.17. Se eliminará en v1.18.
 */
@Controller('webhooks/mercadopago')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async mercadopagoWebhook(
    @Query('topic') topic: string,
    @Query('id') id: string,
    @Query('data.id') dataId: string,
    @Query('creatorId') creatorId: string,
    @Body() body: WebhookPayloadDto,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
  ) {
    const finalDataId = dataId || id || body?.data?.id || '';
    const finalId = id || body?.data?.id || '';

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
}
