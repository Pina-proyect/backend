import {
  BadRequestException,
  ConflictException,
  type ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { WithdrawalsController, JwtAuthGuard } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import type { WithdrawalView } from './withdrawals.mapper';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';

/**
 * HTTP de la creadora (v1.27, REQ-WD-1/2/3): rutas `creators/me/withdrawals`,
 * status codes (200 balance/listado, 201 alta, 200 replay, 400 saldo/validación,
 * 401 sin JWT, 409 uno-en-proceso) y contrato `WithdrawalView` (REQ-WD-6).
 * El `WithdrawalsService` se mockea; el guard JWT se reemplaza por un stub que
 * inyecta `req.user` desde `x-test-user` para poder ejercitar el código real.
 */
const CREATOR_ID = 'creator-1';

/** Fila ya proyectada al contrato público (REQ-WD-6). */
function makeView(overrides: Partial<WithdrawalView> = {}): WithdrawalView {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'w-1',
    creatorId: CREATOR_ID,
    amountCents: 100000,
    currency: 'ARS',
    status: 'requested',
    destinationPlatform: 'mercadopago',
    destinationReference: null,
    evidence: null,
    clientRequestId: 'abc',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Request mínimo que el guard stub manipula. */
interface StubRequest {
  headers: Record<string, string | undefined>;
  user?: { id: string };
}

/** Guard JWT stub: exige `x-test-user` (401 si falta) e inyecta el creador. */
const jwtGuardStub = {
  canActivate: (ctx: ExecutionContext): boolean => {
    const req = ctx.switchToHttp().getRequest<StubRequest>();
    const id = req.headers['x-test-user'];
    if (!id) throw new UnauthorizedException();
    req.user = { id };
    return true;
  },
};

/** Extrae el cuerpo tipado de una respuesta supertest. */
const bodyOf = <T>(res: { body: unknown }): T => res.body as T;

/** Servidor HTTP tipado (evita el `any` de `getHttpServer()`). */
type HttpServer = import('http').Server;

describe('WithdrawalsController — creadora (HTTP)', () => {
  let app: INestApplication;
  let server: HttpServer;
  let service: {
    getBalance: jest.Mock;
    list: jest.Mock;
    create: jest.Mock;
  };

  const configGet = jest.fn((key: string) => {
    if (key === 'NODE_ENV') return 'test';
    if (key === 'WITHDRAWAL_MIN_AMOUNT') return 0;
    return undefined;
  });

  beforeEach(async () => {
    service = {
      getBalance: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WithdrawalsController],
      providers: [
        { provide: WithdrawalsService, useValue: service },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuardStub)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(
      new GlobalExceptionFilter({
        get: configGet,
      } as unknown as ConfigService),
    );
    await app.init();
    server = app.getHttpServer() as HttpServer;
  });

  afterEach(async () => {
    await app.close();
  });

  const asCreator = (r: request.Test) => r.set('x-test-user', CREATOR_ID);

  describe('GET /creators/me/withdrawals/balance', () => {
    it('200 con amountCents/currency de la creadora autenticada', async () => {
      service.getBalance.mockResolvedValue({
        amountCents: 139500,
        currency: 'ARS',
      });

      const res = await asCreator(
        request(server).get('/creators/me/withdrawals/balance'),
      );

      expect(res.status).toBe(200);
      expect(bodyOf<{ amountCents: number; currency: string }>(res)).toEqual({
        amountCents: 139500,
        currency: 'ARS',
      });
      expect(service.getBalance).toHaveBeenCalledWith(CREATOR_ID);
    });

    it('401 sin JWT de creadora', async () => {
      const res = await request(server).get('/creators/me/withdrawals/balance');

      expect(res.status).toBe(401);
      expect(service.getBalance).not.toHaveBeenCalled();
    });
  });

  describe('GET /creators/me/withdrawals', () => {
    it('200 con el listado propio y el contrato WithdrawalView', async () => {
      service.list.mockResolvedValue([makeView({ id: 'w-2' })]);

      const res = await asCreator(
        request(server).get('/creators/me/withdrawals'),
      );

      expect(res.status).toBe(200);
      const body = bodyOf<WithdrawalView[]>(res);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: 'w-2',
        creatorId: CREATOR_ID,
        amountCents: 100000,
        currency: 'ARS',
        status: 'requested',
        clientRequestId: 'abc',
      });
      // El mapper oculta columnas internas de auditoría (REQ-WD-6).
      expect(body[0]).not.toHaveProperty('reviewedAt');
      expect(body[0]).not.toHaveProperty('paidAt');
      expect(service.list).toHaveBeenCalledWith(CREATOR_ID);
    });
  });

  describe('POST /creators/me/withdrawals', () => {
    it('201 al crear un retiro nuevo', async () => {
      service.create.mockResolvedValue({
        withdrawal: makeView(),
        created: true,
      });

      const res = await asCreator(
        request(server).post('/creators/me/withdrawals'),
      ).send({ amount: 1000, clientRequestId: 'abc' });

      expect(res.status).toBe(201);
      expect(bodyOf<WithdrawalView>(res)).toMatchObject({
        id: 'w-1',
        amountCents: 100000,
        status: 'requested',
        clientRequestId: 'abc',
      });
      expect(service.create).toHaveBeenCalledWith(CREATOR_ID, {
        amount: 1000,
        clientRequestId: 'abc',
      });
    });

    it('200 en replay idempotente (mismo clientRequestId, sin duplicar)', async () => {
      service.create.mockResolvedValue({
        withdrawal: makeView({ id: 'w-old' }),
        created: false,
      });

      const res = await asCreator(
        request(server).post('/creators/me/withdrawals'),
      ).send({ amount: 1000, clientRequestId: 'abc' });

      expect(res.status).toBe(200);
      expect(bodyOf<WithdrawalView>(res).id).toBe('w-old');
    });

    it('400 con mensaje en español cuando el saldo es insuficiente', async () => {
      service.create.mockRejectedValue(
        new BadRequestException('Saldo insuficiente para solicitar el retiro'),
      );

      const res = await asCreator(
        request(server).post('/creators/me/withdrawals'),
      ).send({ amount: 2000, clientRequestId: 'abc' });

      expect(res.status).toBe(400);
      expect(bodyOf<{ message: string }>(res).message).toBe(
        'Saldo insuficiente para solicitar el retiro',
      );
    });

    it('409 cuando ya existe un retiro en proceso', async () => {
      service.create.mockRejectedValue(
        new ConflictException('Ya existe un retiro en proceso'),
      );

      const res = await asCreator(
        request(server).post('/creators/me/withdrawals'),
      ).send({ amount: 1000, clientRequestId: 'abc' });

      expect(res.status).toBe(409);
      expect(bodyOf<{ message: string }>(res).message).toBe(
        'Ya existe un retiro en proceso',
      );
    });

    it('400 cuando el body no valida (ValidationPipe) sin llamar al service', async () => {
      const res = await asCreator(
        request(server).post('/creators/me/withdrawals'),
      ).send({ amount: -5 });

      expect(res.status).toBe(400);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('401 sin JWT de creadora', async () => {
      const res = await request(server)
        .post('/creators/me/withdrawals')
        .send({ amount: 1000, clientRequestId: 'abc' });

      expect(res.status).toBe(401);
      expect(service.create).not.toHaveBeenCalled();
    });
  });
});
