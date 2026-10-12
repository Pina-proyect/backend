import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Withdrawal } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';
import { toWithdrawalView, WithdrawalView } from './withdrawals.mapper';

export type { WithdrawalView } from './withdrawals.mapper';

/** Estados que bloquean una nueva solicitud (uno-a-la-vez). */
export const WITHDRAWAL_ACTIVE_STATUSES = ['requested', 'approved'] as const;
/** Estados que retienen saldo (rejected no descuenta). */
export const WITHDRAWAL_HELD_STATUSES = [
  'requested',
  'approved',
  'paid',
] as const;

/** Máquina de estados administrativa (REQ-WD-4): paid/rejected terminales. */
const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ['approved', 'rejected'],
  approved: ['paid', 'rejected'],
  paid: [],
  rejected: [],
};

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  /** Redondeo half-up determinista sobre valores positivos (D2). */
  static halfUp(n: number): number {
    return Math.floor(n + 0.5);
  }

  /** Saldo disponible de la creadora en centavos (REQ-WD-1). */
  async getBalance(
    creatorId: string,
  ): Promise<{ amountCents: number; currency: string }> {
    const amountCents = await this.computeAvailableCents(
      this.prisma,
      creatorId,
    );
    return { amountCents, currency: 'ARS' };
  }

  /** Retiros de la creadora, más recientes primero (REQ-WD-3). */
  async list(creatorId: string): Promise<WithdrawalView[]> {
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
    });
    return withdrawals.map((withdrawal) => toWithdrawalView(withdrawal));
  }

  /**
   * Crea una solicitud `requested` de forma atómica e idempotente (REQ-WD-2, D7).
   * Toma un lock de fila del `Creator` para serializar POST concurrentes y
   * valida el saldo dentro de la misma transacción.
   */
  async create(
    creatorId: string,
    dto: CreateWithdrawalDto,
  ): Promise<{ withdrawal: WithdrawalView; created: boolean }> {
    const amountCents = WithdrawalsService.halfUp(dto.amount * 100);
    const minAmount = this.config.get<number>('WITHDRAWAL_MIN_AMOUNT') ?? 0;
    if (dto.amount < minAmount) {
      throw new BadRequestException(
        'El monto es inferior al mínimo de retiro permitido',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Lock de fila: la API fluent de Prisma no expone SELECT FOR UPDATE.
        await tx.$queryRaw`SELECT id FROM "Creator" WHERE id = ${creatorId} FOR UPDATE`;

        // Idempotencia por clientRequestId ANTES del chequeo "en proceso"
        // para que un replay no devuelva 409.
        const replay = await tx.withdrawal.findFirst({
          where: { creatorId, clientRequestId: dto.clientRequestId },
        });
        if (replay) {
          return { withdrawal: toWithdrawalView(replay), created: false };
        }

        const inProgress = await tx.withdrawal.findFirst({
          where: {
            creatorId,
            status: { in: [...WITHDRAWAL_ACTIVE_STATUSES] },
          },
        });
        if (inProgress) {
          throw new ConflictException('Ya existe un retiro en proceso');
        }

        const availableCents = await this.computeAvailableCents(tx, creatorId);
        if (amountCents > availableCents) {
          throw new BadRequestException(
            'Saldo insuficiente para solicitar el retiro',
          );
        }

        try {
          const created = await tx.withdrawal.create({
            data: {
              creatorId,
              amountCents,
              currency: 'ARS',
              status: 'requested',
              destinationPlatform: dto.destinationPlatform ?? 'mercadopago',
              destinationReference: dto.destinationReference ?? null,
              clientRequestId: dto.clientRequestId,
            },
          });
          return { withdrawal: toWithdrawalView(created), created: true };
        } catch (error) {
          // Carrera: otro POST creó el mismo (creatorId, clientRequestId).
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            const raced = await tx.withdrawal.findFirst({
              where: { creatorId, clientRequestId: dto.clientRequestId },
            });
            if (raced) {
              return { withdrawal: toWithdrawalView(raced), created: false };
            }
          }
          throw error;
        }
      },
      { timeout: 10_000 },
    );
  }

  /** Transición administrativa de estado + notificación in-app (REQ-WD-4/5). */
  async updateStatus(
    id: string,
    dto: UpdateWithdrawalStatusDto,
  ): Promise<WithdrawalView> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });
    if (!withdrawal) {
      throw new NotFoundException('Retiro no encontrado');
    }

    const allowed = VALID_TRANSITIONS[withdrawal.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException('Transición de estado inválida');
    }

    const requiresEvidence = dto.status === 'paid' || dto.status === 'rejected';
    if (requiresEvidence && !dto.evidence) {
      throw new BadRequestException(
        'La evidencia es obligatoria para este estado',
      );
    }

    const data: Prisma.WithdrawalUpdateInput = { status: dto.status };
    if (dto.status === 'approved' || dto.status === 'rejected') {
      data.reviewedAt = new Date();
    }
    if (dto.status === 'rejected') {
      data.evidence = dto.evidence ?? null;
    }
    if (dto.status === 'paid') {
      data.paidAt = new Date();
      data.evidence = dto.evidence ?? null;
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data,
    });

    await this.notifyStatusChange(updated);

    return toWithdrawalView(updated);
  }

  /** Saldo disponible determinista en centavos (REQ-WD-1, D1/D2). */
  private async computeAvailableCents(
    client: Prisma.TransactionClient,
    creatorId: string,
  ): Promise<number> {
    const donations = await client.donation.findMany({
      where: { creatorId, status: 'approved' },
      select: { amount: true },
    });
    const totalCents = donations.reduce(
      (sum, donation) => sum + WithdrawalsService.halfUp(donation.amount * 100),
      0,
    );
    const netCents = WithdrawalsService.halfUp((totalCents * 93) / 100);

    const withdrawals = await client.withdrawal.findMany({
      where: { creatorId, status: { in: [...WITHDRAWAL_HELD_STATUSES] } },
      select: { amountCents: true },
    });
    const heldCents = withdrawals.reduce(
      (sum, withdrawal) => sum + withdrawal.amountCents,
      0,
    );

    return Math.max(0, netCents - heldCents);
  }

  /**
   * Notificación in-app post-commit best-effort (REQ-WD-5, D6): un fallo de
   * notificación no revierte la transición de estado.
   */
  private async notifyStatusChange(withdrawal: Withdrawal): Promise<void> {
    const copy: Record<string, { title: string; message: string }> = {
      approved: {
        title: 'Retiro aprobado',
        message: 'Tu solicitud de retiro fue aprobada.',
      },
      paid: {
        title: 'Retiro pagado',
        message: 'Tu retiro fue marcado como pagado.',
      },
      rejected: {
        title: 'Retiro rechazado',
        message: 'Tu solicitud de retiro fue rechazada.',
      },
    };

    const text = copy[withdrawal.status];
    if (!text) return;

    try {
      await this.notifications.create({
        creatorId: withdrawal.creatorId,
        type: 'withdrawal',
        title: text.title,
        message: text.message,
        link: `/withdrawals/${withdrawal.id}`,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo notificar el retiro ${withdrawal.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
