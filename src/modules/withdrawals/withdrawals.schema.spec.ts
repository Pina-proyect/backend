import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';

/**
 * Contrato de persistencia de retiros (v1.27, D1/D3):
 * modelo `Withdrawal` aditivo, montos en centavos (Int), estado String y
 * unique `(creatorId, clientRequestId)`; migración aditiva con índices.
 */
const withdrawalModel = () =>
  Prisma.dmmf.datamodel.models.find((m) => m.name === 'Withdrawal');

const withdrawalField = (name: string) =>
  withdrawalModel()?.fields.find((f) => f.name === name);

describe('Withdrawal — contrato del modelo Prisma', () => {
  it('expone el modelo con los campos de la fundación persistente', () => {
    const model = withdrawalModel();

    expect(model).toBeDefined();
    expect(model?.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        'id',
        'creatorId',
        'amountCents',
        'currency',
        'status',
        'destinationPlatform',
        'destinationReference',
        'evidence',
        'clientRequestId',
        'reviewedAt',
        'paidAt',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('persiste el monto como Int obligatorio y el estado con default requested', () => {
    expect(withdrawalField('amountCents')?.type).toBe('Int');
    expect(withdrawalField('amountCents')?.isRequired).toBe(true);
    expect(withdrawalField('status')?.type).toBe('String');
    expect(withdrawalField('status')?.default).toBe('requested');
    expect(withdrawalField('evidence')?.isRequired).toBe(false);
  });

  it('garantiza la idempotencia con unique (creatorId, clientRequestId)', () => {
    expect(withdrawalModel()?.uniqueFields).toContainEqual([
      'creatorId',
      'clientRequestId',
    ]);
  });
});

describe('Withdrawal — migración aditiva', () => {
  it('crea la tabla con FK a Creator, unique e índices de consulta', () => {
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    const dir = readdirSync(migrationsDir).find((d) =>
      d.endsWith('_add_withdrawals'),
    );

    expect(dir).toBeDefined();

    const sql = readFileSync(
      join(migrationsDir, dir as string, 'migration.sql'),
      'utf8',
    );

    expect(sql).toMatch(/CREATE TABLE "Withdrawal"/);
    expect(sql).toMatch(
      /FOREIGN KEY \("creatorId"\) REFERENCES "Creator"\("id"\)/,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "Withdrawal_creatorId_clientRequestId_key"/,
    );
    expect(sql).toMatch(/CREATE INDEX "Withdrawal_creatorId_status_idx"/);
    expect(sql).toMatch(/CREATE INDEX "Withdrawal_creatorId_createdAt_idx"/);
  });
});
