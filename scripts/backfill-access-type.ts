import { PrismaClient } from '@prisma/client';

/**
 * Backfill idempotente: normaliza `Access.type 'PACK' → 'purchase'`
 * (spec packs-unlock). Sin cambio de schema ni DDL: solo DML acotado.
 *
 * Patrón `scripts/migrate-r2.ts`: lógica pura exportada y testeable + entry
 * CLI condicional (`require.main === module`).
 *
 * Idempotencia: el `updateMany` filtra por `where: { type: 'PACK' }`, por lo
 * que una segunda ejecución no encuentra filas y no modifica nada. Los tipos
 * `purchase`, `gift` y `subscription` jamás entran en el `where`.
 */

/** Superficie mínima de Prisma que usa el backfill (permite mockear en tests). */
export interface BackfillAccessClient {
  access: {
    count(args: { where: { type: string } }): Promise<number>;
    updateMany(args: {
      where: { type: string };
      data: { type: string };
    }): Promise<{ count: number }>;
  };
}

const prisma = new PrismaClient();

/**
 * Ejecuta el backfill `'PACK' → 'purchase'`.
 * @returns conteo antes, filas actualizadas y conteo después (para verificar).
 */
export async function runBackfill(
  db: BackfillAccessClient = prisma,
): Promise<{ before: number; updated: number; after: number }> {
  const before = await db.access.count({ where: { type: 'PACK' } });
  console.log(`Access con type='PACK' antes del backfill: ${before}`);

  const { count: updated } = await db.access.updateMany({
    where: { type: 'PACK' },
    data: { type: 'purchase' },
  });
  const after = await db.access.count({ where: { type: 'PACK' } });

  console.log(`Filas normalizadas a 'purchase': ${updated}`);
  console.log(`Access con type='PACK' después del backfill: ${after}`);

  return { before, updated, after };
}

// CLI entry — Uso: pnpm backfill:access-type
const isMain = require.main === module;
if (isMain) {
  runBackfill()
    .then((result) => {
      console.log('Resultado:', result);
      return prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error('Backfill falló:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}