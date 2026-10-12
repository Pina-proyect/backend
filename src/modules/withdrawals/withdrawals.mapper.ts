import { Withdrawal } from '@prisma/client';

/** Contrato público de un retiro (v1.27, REQ-WD-6). */
export interface WithdrawalView {
  id: string;
  creatorId: string;
  amountCents: number;
  currency: string;
  status: string;
  destinationPlatform: string;
  destinationReference: string | null;
  evidence: string | null;
  clientRequestId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Proyecta la fila persistida al contrato de respuesta, ocultando columnas de
 * auditoría que no forman parte de REQ-WD-6 (`reviewedAt`, `paidAt`).
 */
export function toWithdrawalView(withdrawal: Withdrawal): WithdrawalView {
  return {
    id: withdrawal.id,
    creatorId: withdrawal.creatorId,
    amountCents: withdrawal.amountCents,
    currency: withdrawal.currency,
    status: withdrawal.status,
    destinationPlatform: withdrawal.destinationPlatform,
    destinationReference: withdrawal.destinationReference,
    evidence: withdrawal.evidence,
    clientRequestId: withdrawal.clientRequestId,
    createdAt: withdrawal.createdAt,
    updatedAt: withdrawal.updatedAt,
  };
}
