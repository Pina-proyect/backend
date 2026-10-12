import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsAdminGuard } from './guards/withdrawals-admin.guard';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

/**
 * Endpoint administrativo de retiros (v1.27, REQ-WD-4):
 * - PATCH /withdrawals/:id/status — transición validada por el servicio y
 *   autenticada con `WITHDRAWALS_ADMIN_TOKEN` (guard fail-closed).
 */
@Controller('withdrawals')
export class WithdrawalsAdminController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Patch(':id/status')
  @UseGuards(WithdrawalsAdminGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWithdrawalStatusDto,
  ) {
    return this.withdrawalsService.updateStatus(id, dto);
  }
}
