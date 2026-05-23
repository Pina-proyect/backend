import { Controller, Post, Body, Req, UseGuards, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('create-preference')
  async createPreference(@Body('packId') packId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.paymentsService.createPreference(packId, userId);
  }

  @Post('webhook')
  async webhook(
    @Query('topic') topic: string,
    @Query('id') id: string,
    @Query('creatorId') creatorId: string,
    @Body() body: any
  ) {
    const finalId = id || body?.data?.id;
    const finalTopic = topic || body?.type;

    return this.paymentsService.handleWebhook(finalTopic, finalId, creatorId);
  }
}
