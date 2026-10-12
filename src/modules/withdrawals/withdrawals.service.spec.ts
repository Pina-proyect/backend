import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { WithdrawalsService } from './withdrawals.service';

/**
 * Dominio de retiros (v1.27, HU4.2). Cubre REQ-WD-1..5 con PrismaService,
 * NotificationService y ConfigService mockeados; `$transaction` ejecuta el
 * callback con el propio mock (el lock `FOR UPDATE` se verifica como llamada).
 */
describe('WithdrawalsService — dominio de retiros', () => {
  let service: WithdrawalsService;

  const prismaMock = {
    donation: { findMany: jest.fn() },
    withdrawal: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const notificationsMock = { create: jest.fn() };
  const configMock = { get: jest.fn(() => 0) };

  /** Fila cruda del modelo Withdrawal (defaults reales de Prisma). */
  const row = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'w-1',
    creatorId: 'c1',
    amountCents: 100000,
    currency: 'ARS',
    status: 'requested',
    destinationPlatform: 'mercadopago',
    destinationReference: null,
    evidence: null,
    clientRequestId: 'req-1',
    reviewedAt: null,
    paidAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    configMock.get.mockReturnValue(0);
    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationService, useValue: notificationsMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<WithdrawalsService>(WithdrawalsService);
  });

  /** Configura una solicitud sin colisiones: sin replay ni retiro en proceso. */
  const freeSlot = () => {
    prismaMock.withdrawal.findFirst.mockResolvedValue(null);
    prismaMock.withdrawal.findMany.mockResolvedValue([]);
  };

  describe('halfUp (redondeo determinista D2)', () => {
    it.each([
      [9304.65, 9305],
      [139500, 139500],
      [0.4, 0],
      [0.5, 1],
    ])('halfUp(%s) === %s', (input, expected) => {
      expect(WithdrawalsService.halfUp(input)).toBe(expected);
    });
  });

  describe('getBalance (REQ-WD-1)', () => {
    it('suma donaciones approved y aplica la comisión 93% sobre el total', async () => {
      prismaMock.donation.findMany.mockResolvedValue([
        { amount: 1000 },
        { amount: 500 },
      ]);
      prismaMock.withdrawal.findMany.mockResolvedValue([]);

      const result = await service.getBalance('c1');

      expect(result).toEqual({ amountCents: 139500, currency: 'ARS' });
      expect(prismaMock.donation.findMany).toHaveBeenCalledWith({
        where: { creatorId: 'c1', status: 'approved' },
        select: { amount: true },
      });
    });

    it('redondea half-up la comisión sobre el total (100.05 → 9305)', async () => {
      prismaMock.donation.findMany.mockResolvedValue([{ amount: 100.05 }]);
      prismaMock.withdrawal.findMany.mockResolvedValue([]);

      expect((await service.getBalance('c1')).amountCents).toBe(9305);
    });

    it('descuenta retiros en proceso y libera el saldo al rechazarse', async () => {
      prismaMock.donation.findMany.mockResolvedValue([{ amount: 1500 }]);
      prismaMock.withdrawal.findMany.mockResolvedValue([
        { amountCents: 50000 },
      ]);

      expect((await service.getBalance('c1')).amountCents).toBe(89500);

      // rejected queda fuera del filtro in-use → el saldo vuelve a 139500
      prismaMock.withdrawal.findMany.mockResolvedValue([]);
      expect((await service.getBalance('c1')).amountCents).toBe(139500);
      expect(prismaMock.withdrawal.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            creatorId: 'c1',
            status: { in: ['requested', 'approved', 'paid'] },
          },
        }),
      );
    });

    it('nunca devuelve un saldo negativo (clamp a 0)', async () => {
      prismaMock.donation.findMany.mockResolvedValue([]);
      prismaMock.withdrawal.findMany.mockResolvedValue([
        { amountCents: 50000 },
      ]);

      expect((await service.getBalance('c1')).amountCents).toBe(0);
    });
  });

  describe('create (REQ-WD-2, D7)', () => {
    it('crea un retiro requested con el monto convertido a centavos y bajo lock FOR UPDATE', async () => {
      prismaMock.donation.findMany.mockResolvedValue([{ amount: 1500 }]);
      freeSlot();
      prismaMock.withdrawal.create.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve(row(args.data)),
      );

      const result = await service.create('c1', {
        amount: 1000,
        clientRequestId: 'abc',
      });

      expect(result.created).toBe(true);
      expect(result.withdrawal).toMatchObject({
        creatorId: 'c1',
        amountCents: 100000,
        currency: 'ARS',
        status: 'requested',
        clientRequestId: 'abc',
      });
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(prismaMock.withdrawal.create).toHaveBeenCalledTimes(1);
      const createCalls = prismaMock.withdrawal.create.mock.calls as {
        data: Record<string, unknown>;
      }[][];
      expect(createCalls[0]?.[0]?.data).toMatchObject({
        creatorId: 'c1',
        amountCents: 100000,
        currency: 'ARS',
        status: 'requested',
        clientRequestId: 'abc',
      });
    });

    it('rechaza con 400 cuando el saldo es insuficiente sin crear el registro', async () => {
      prismaMock.donation.findMany.mockResolvedValue([{ amount: 1500 }]);
      freeSlot();

      await expect(
        service.create('c1', { amount: 2000, clientRequestId: 'abc' }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.withdrawal.create).not.toHaveBeenCalled();
    });

    it('rechaza con 400 cuando el monto es inferior a WITHDRAWAL_MIN_AMOUNT', async () => {
      configMock.get.mockReturnValue(500);

      await expect(
        service.create('c1', { amount: 100, clientRequestId: 'abc' }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza con 409 cuando ya existe un retiro en proceso', async () => {
      prismaMock.withdrawal.findFirst
        .mockResolvedValueOnce(null) // idempotencia
        .mockResolvedValueOnce(row({ status: 'requested' })); // en proceso

      await expect(
        service.create('c1', { amount: 1000, clientRequestId: 'abc' }),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.withdrawal.create).not.toHaveBeenCalled();
    });

    it('replay idempotente: devuelve el existente (created=false) antes de chequear en-proceso', async () => {
      prismaMock.withdrawal.findFirst.mockResolvedValueOnce(
        row({ id: 'w-old', clientRequestId: 'abc' }),
      );

      const result = await service.create('c1', {
        amount: 1000,
        clientRequestId: 'abc',
      });

      expect(result.created).toBe(false);
      expect(result.withdrawal.id).toBe('w-old');
      // Sólo la consulta de idempotencia corrió: el chequeo en-proceso no se alcanzó.
      expect(prismaMock.withdrawal.findFirst).toHaveBeenCalledTimes(1);
      expect(prismaMock.withdrawal.create).not.toHaveBeenCalled();
    });

    it('resuelve la colisión P2002 re-consultando y devolviendo el existente', async () => {
      prismaMock.donation.findMany.mockResolvedValue([{ amount: 1500 }]);
      prismaMock.withdrawal.findMany.mockResolvedValue([]);
      prismaMock.withdrawal.findFirst
        .mockResolvedValueOnce(null) // idempotencia
        .mockResolvedValueOnce(null) // en proceso
        .mockResolvedValueOnce(row({ id: 'w-raced' })); // re-fetch tras P2002
      prismaMock.withdrawal.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      const result = await service.create('c1', {
        amount: 1000,
        clientRequestId: 'abc',
      });

      expect(result.created).toBe(false);
      expect(result.withdrawal.id).toBe('w-raced');
    });

    it('serializa POST concurrentes del mismo creador: uno crea y el otro colisiona', async () => {
      const store: Record<string, unknown>[] = [];
      const tx = {
        donation: { findMany: () => [{ amount: 1500 }] },
        withdrawal: {
          findMany: () => [],
          findFirst: (args: {
            where: { clientRequestId?: string };
          }): unknown => {
            if (args.where.clientRequestId !== undefined) {
              return (
                store.find(
                  (w) => w.clientRequestId === args.where.clientRequestId,
                ) ?? null
              );
            }
            return (
              store.find((w) =>
                ['requested', 'approved'].includes(w.status as string),
              ) ?? null
            );
          },
          create: (args: { data: Record<string, unknown> }): unknown => {
            const created = row(args.data);
            store.push(created);
            return created;
          },
        },
        $queryRaw: () => undefined,
      };

      // Emula el lock de fila: encadena las transacciones concurrentes.
      let tail: Promise<unknown> = Promise.resolve();
      prismaMock.$transaction.mockImplementation(
        (cb: (t: unknown) => unknown) => {
          const run = tail.then(() => cb(tx));
          tail = run.catch(() => undefined);
          return run;
        },
      );

      const results = await Promise.allSettled([
        service.create('c1', { amount: 1000, clientRequestId: 'a' }),
        service.create('c1', { amount: 1000, clientRequestId: 'b' }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      expect(store).toHaveLength(1);
    });
  });

  describe('list (REQ-WD-3)', () => {
    it('devuelve los retiros propios ordenados por createdAt desc', async () => {
      prismaMock.withdrawal.findMany.mockResolvedValue([
        row({ id: 'w-2' }),
        row({ id: 'w-1' }),
      ]);

      const result = await service.list('c1');

      expect(result.map((w) => w.id)).toEqual(['w-2', 'w-1']);
      expect(prismaMock.withdrawal.findMany).toHaveBeenCalledWith({
        where: { creatorId: 'c1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateStatus (REQ-WD-4/5)', () => {
    it('requested→approved marca reviewedAt y notifica a la creadora', async () => {
      prismaMock.withdrawal.findUnique.mockResolvedValue(row());
      prismaMock.withdrawal.update.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve(row({ ...args.data })),
      );

      const result = await service.updateStatus('w-1', { status: 'approved' });

      expect(result.status).toBe('approved');
      const updateCalls = prismaMock.withdrawal.update.mock.calls as {
        where: { id: string };
        data: { status: string; reviewedAt?: unknown };
      }[][];
      const updateArgs = updateCalls[0]?.[0];
      expect(updateArgs).toMatchObject({
        where: { id: 'w-1' },
        data: { status: 'approved' },
      });
      expect(updateArgs?.data?.reviewedAt).toBeInstanceOf(Date);
      expect(notificationsMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ creatorId: 'c1', type: 'withdrawal' }),
      );
    });

    it('approved→paid exige y persiste la evidencia', async () => {
      prismaMock.withdrawal.findUnique.mockResolvedValue(
        row({ status: 'approved' }),
      );
      prismaMock.withdrawal.update.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve(row({ status: 'approved', ...args.data })),
      );

      const result = await service.updateStatus('w-1', {
        status: 'paid',
        evidence: 'MP ref 123',
      });

      expect(result.status).toBe('paid');
      expect(result.evidence).toBe('MP ref 123');
      const updateCalls = prismaMock.withdrawal.update.mock.calls as {
        where: { id: string };
        data: { status: string; evidence: string; paidAt?: unknown };
      }[][];
      const updateArgs = updateCalls[0]?.[0];
      expect(updateArgs).toMatchObject({
        where: { id: 'w-1' },
        data: { status: 'paid', evidence: 'MP ref 123' },
      });
      expect(updateArgs?.data?.paidAt).toBeInstanceOf(Date);
    });

    it('approved→rejected exige evidencia y notifica', async () => {
      prismaMock.withdrawal.findUnique.mockResolvedValue(
        row({ status: 'approved' }),
      );
      prismaMock.withdrawal.update.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve(row({ status: 'approved', ...args.data })),
      );

      const result = await service.updateStatus('w-1', {
        status: 'rejected',
        evidence: 'motivo administrativo',
      });

      expect(result.status).toBe('rejected');
      expect(notificationsMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'withdrawal' }),
      );
    });

    it('rechaza con 409 una transición inválida (paid es terminal)', async () => {
      prismaMock.withdrawal.findUnique.mockResolvedValue(
        row({ status: 'paid' }),
      );

      await expect(
        service.updateStatus('w-1', { status: 'approved' }),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.withdrawal.update).not.toHaveBeenCalled();
    });

    it('rechaza con 400 paid sin evidencia', async () => {
      prismaMock.withdrawal.findUnique.mockResolvedValue(
        row({ status: 'approved' }),
      );

      await expect(
        service.updateStatus('w-1', { status: 'paid' }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.withdrawal.update).not.toHaveBeenCalled();
    });

    it('rechaza con 400 rejected sin evidencia', async () => {
      prismaMock.withdrawal.findUnique.mockResolvedValue(
        row({ status: 'approved' }),
      );

      await expect(
        service.updateStatus('w-1', { status: 'rejected' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 404 si el retiro no existe', async () => {
      prismaMock.withdrawal.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', { status: 'approved' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('no revierte la transición si falla la notificación (best-effort D6)', async () => {
      prismaMock.withdrawal.findUnique.mockResolvedValue(row());
      prismaMock.withdrawal.update.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve(row({ ...args.data })),
      );
      notificationsMock.create.mockRejectedValueOnce(new Error('SMTP caído'));

      await expect(
        service.updateStatus('w-1', { status: 'approved' }),
      ).resolves.toMatchObject({ status: 'approved' });
    });
  });
});
