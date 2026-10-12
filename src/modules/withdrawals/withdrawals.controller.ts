import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { WithdrawalsService } from './withdrawals.service';
import type { WithdrawalView } from './withdrawals.mapper';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';

/**
 * Guard JWT de creadora reutilizable. Se expone como constante estable para
 * que los tests puedan reemplazarlo con `overrideGuard` (AuthGuard ya memoiza
 * por tipo, así que la referencia es única).
 */
export const JwtAuthGuard = AuthGuard('jwt');

/**
 * Endpoints de la creadora autenticada (v1.27, REQ-WD-1/2/3):
 * - GET  /creators/me/withdrawals/balance — saldo disponible en centavos.
 * - GET  /creators/me/withdrawals         — listado propio (createdAt desc).
 * - POST /creators/me/withdrawals         — solicitud `requested` idempotente.
 */
@Controller('creators/me/withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getBalance(@Req() req: AuthenticatedRequest) {
    return this.withdrawalsService.getBalance(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: AuthenticatedRequest) {
    return this.withdrawalsService.list(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWithdrawalDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WithdrawalView> {
    const { withdrawal, created } = await this.withdrawalsService.create(
      req.user.id,
      dto,
    );
    // 201 en la primera creación; 200 en replay idempotente (D7).
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return withdrawal;
  }
}
