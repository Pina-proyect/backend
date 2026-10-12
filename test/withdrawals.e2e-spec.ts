import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../prisma/prisma.service';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

/**
 * E2E de retiros de creadoras (v1.27, HU4.2) contra Postgres REAL:
 * - REQ-WD-1: balance 139500 (1500 ARS × 0.93) y rechazo que libera saldo.
 * - REQ-WD-2: POST 201 `requested`, saldo insuficiente 400, uno-en-proceso 409,
 *   replay idempotente 200 con el mismo `id`.
 * - REQ-WD-3: listado propio en orden `createdAt` desc, aislado por creadora.
 * - REQ-WD-4: PATCH admin fail-closed 401, transición válida 200, transición
 *   inválida 409, `paid` sin evidencia 400, 404 inexistente.
 * - REQ-WD-5: se crea una fila `Notification` type='withdrawal' en approved/paid/rejected.
 * - REQ-WD-6: contrato `WithdrawalView` completo y errores en español.
 * - D7: concurrencia REAL con `Promise.all` (dos POST → 1×201 + 1×409; mismo
 *   `clientRequestId` → 1×201 + 1×200 con el mismo `id`).
 *
 * Harness: AppModule real + Postgres real (`pina_postgres`, DATABASE_URL) + Redis;
 * ver `test/jest-e2e.json` y `docker-compose.yml`. Corre en NODE_ENV=test, donde
 * el `GlobalExceptionFilter` NO sanitiza los mensajes 4xx (solo lo hace en prod).
 */

const PREFIX = '/api/pina';
const SUFFIX = Date.now().toString(36);
const ADMIN_TOKEN = `e2e-withdrawals-admin-${SUFFIX}`;
// El guard admin es fail-closed: sin este token todo PATCH responde 401. Se fija
// antes de la primera request y `ConfigService.get` lo resuelve vía process.env.
process.env.WITHDRAWALS_ADMIN_TOKEN = ADMIN_TOKEN;

const CONTRACT_FIELDS = [
  'id',
  'creatorId',
  'amountCents',
  'currency',
  'status',
  'destinationPlatform',
  'destinationReference',
  'evidence',
  'clientRequestId',
  'createdAt',
  'updatedAt',
];

interface WithdrawalView {
  id: string;
  creatorId: string;
  amountCents: number;
  currency: string;
  status: string;
  destinationPlatform: string;
  destinationReference: string | null;
  evidence: string | null;
  clientRequestId: string;
  createdAt: string;
  updatedAt: string;
}

interface BalanceView {
  amountCents: number;
  currency: string;
}

const NON_EXISTENT_ID = '00000000-0000-4000-8000-000000000000';

describe('Withdrawals (e2e) — v1.27 / HU4.2', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = (label: string) => `e2e-wd-${label}-${SUFFIX}@test.com`;
  const createdEmails: string[] = [];

  let flowCreatorId: string;
  let flowToken: string;
  let poorCreatorId: string;
  let poorToken: string;
  let busyCreatorId: string;
  let busyToken: string;
  let rejectCreatorId: string;
  let rejectToken: string;
  let listCreatorId: string;
  let listToken: string;
  let otherCreatorId: string;
  let concurrencyCreatorId: string;
  let concurrencyToken: string;
  let replayCreatorId: string;
  let replayToken: string;

  let flowWithdrawalId: string;

  const sign = (sub: string, mail: string) =>
    jwt.sign({ sub, email: mail }, process.env.JWT_SECRET ?? 'test-secret', {
      expiresIn: '15m',
    });

  const makeCreator = async (
    label: string,
    role = 'CREATOR',
  ): Promise<{ id: string; token: string }> => {
    const mail = email(label);
    createdEmails.push(mail);
    const creator = await prisma.creator.create({
      data: {
        email: mail,
        fullName: `E2E Withdrawals ${label}`,
        password: null,
        birthDate: new Date('1990-01-01'),
        provider: 'credentials',
        role,
        verificationStatus: 'verified',
      },
    });
    return { id: creator.id, token: sign(creator.id, mail) };
  };

  const addDonation = (creatorId: string, amount: number, status: string) =>
    prisma.donation.create({ data: { creatorId, amount, status } });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/pina');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter(app.get(ConfigService)));
    await app.init();

    prisma = app.get(PrismaService);

    // Creadora del flujo completo: 1000 + 500 approved (+ una pending que NO
    // debe sumar) → saldo 139500 centavos.
    const flow = await makeCreator('flow');
    flowCreatorId = flow.id;
    flowToken = flow.token;
    await addDonation(flowCreatorId, 1000, 'approved');
    await addDonation(flowCreatorId, 500, 'approved');
    await addDonation(flowCreatorId, 999, 'pending');

    // Saldo 93000 (< 200000 solicitados) → saldo insuficiente.
    const poor = await makeCreator('poor');
    poorCreatorId = poor.id;
    poorToken = poor.token;
    await addDonation(poorCreatorId, 1000, 'approved');

    // Ya tiene un retiro `requested` sembrado → 409 uno-en-proceso.
    const busy = await makeCreator('busy');
    busyCreatorId = busy.id;
    busyToken = busy.token;
    await addDonation(busyCreatorId, 1000, 'approved');
    await prisma.withdrawal.create({
      data: {
        creatorId: busyCreatorId,
        amountCents: 50000,
        clientRequestId: `busy-seed-${SUFFIX}`,
        status: 'requested',
      },
    });

    // Saldo 93000 → retiro 50000 luego `rejected` debe liberar saldo.
    const reject = await makeCreator('reject');
    rejectCreatorId = reject.id;
    rejectToken = reject.token;
    await addDonation(rejectCreatorId, 1000, 'approved');

    // Listado + orden desc (dos filas sembradas con createdAt espaciado).
    const list = await makeCreator('list');
    listCreatorId = list.id;
    listToken = list.token;
    const now = Date.now();
    const oldest = await prisma.withdrawal.create({
      data: {
        creatorId: listCreatorId,
        amountCents: 1000,
        clientRequestId: `list-old-${SUFFIX}`,
        status: 'rejected',
        createdAt: new Date(now - 120_000),
      },
    });
    const newest = await prisma.withdrawal.create({
      data: {
        creatorId: listCreatorId,
        amountCents: 2000,
        clientRequestId: `list-new-${SUFFIX}`,
        status: 'rejected',
        createdAt: new Date(now - 60_000),
      },
    });
    // Guardamos para asserciones de orden.
    (global as unknown as { listIds?: string[] }).listIds = [
      newest.id,
      oldest.id,
    ];

    // Otra creadora con retiro: no debe aparecer en el listado de `flow`.
    const other = await makeCreator('other');
    otherCreatorId = other.id;
    await prisma.withdrawal.create({
      data: {
        creatorId: otherCreatorId,
        amountCents: 1000,
        clientRequestId: `other-${SUFFIX}`,
        status: 'requested',
      },
    });

    // Concurrencia: saldo 93000 para dos POST de 50000.
    const conc = await makeCreator('conc');
    concurrencyCreatorId = conc.id;
    concurrencyToken = conc.token;
    await addDonation(concurrencyCreatorId, 1000, 'approved');

    const replay = await makeCreator('replay');
    replayCreatorId = replay.id;
    replayToken = replay.token;
    await addDonation(replayCreatorId, 1000, 'approved');
  });

  afterAll(async () => {
    if (!prisma) return;
    const creatorIds = [
      flowCreatorId,
      poorCreatorId,
      busyCreatorId,
      rejectCreatorId,
      listCreatorId,
      otherCreatorId,
      concurrencyCreatorId,
      replayCreatorId,
    ].filter((id): id is string => Boolean(id));

    await prisma.notification.deleteMany({
      where: { creatorId: { in: creatorIds } },
    });
    await prisma.withdrawal.deleteMany({
      where: { creatorId: { in: creatorIds } },
    });
    await prisma.donation.deleteMany({
      where: { creatorId: { in: creatorIds } },
    });
    await prisma.creator.deleteMany({
      where: { email: { in: createdEmails } },
    });
    await app.close();
  });

  describe('GET /creators/me/withdrawals/balance (REQ-WD-1)', () => {
    it('200: 1500 ARS approved → 139500 centavos (pending excluida)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${PREFIX}/creators/me/withdrawals/balance`)
        .set('Authorization', `Bearer ${flowToken}`)
        .expect(200);

      const body = res.body as BalanceView;
      expect(body.amountCents).toBe(139500);
      expect(body.currency).toBe('ARS');
    });

    it('401: sin token JWT', async () => {
      await request(app.getHttpServer())
        .get(`${PREFIX}/creators/me/withdrawals/balance`)
        .expect(401);
    });
  });

  describe('POST /creators/me/withdrawals (REQ-WD-2, REQ-WD-6)', () => {
    it('201: crea requested con contrato WithdrawalView completo', async () => {
      const res = await request(app.getHttpServer())
        .post(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${flowToken}`)
        .send({ amount: 1000, clientRequestId: `flow-1-${SUFFIX}` })
        .expect(201);

      const body = res.body as WithdrawalView;
      expect(Object.keys(body).sort()).toEqual([...CONTRACT_FIELDS].sort());
      expect(body.creatorId).toBe(flowCreatorId);
      expect(body.amountCents).toBe(100000);
      expect(body.currency).toBe('ARS');
      expect(body.status).toBe('requested');
      expect(body.destinationPlatform).toBe('mercadopago');
      expect(body.destinationReference).toBeNull();
      expect(body.evidence).toBeNull();
      expect(body.clientRequestId).toBe(`flow-1-${SUFFIX}`);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();

      flowWithdrawalId = body.id;
    });

    it('200 (replay): mismo clientRequestId devuelve el mismo retiro sin duplicar', async () => {
      const res = await request(app.getHttpServer())
        .post(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${flowToken}`)
        .send({ amount: 1000, clientRequestId: `flow-1-${SUFFIX}` })
        .expect(200);

      const body = res.body as WithdrawalView;
      expect(body.id).toBe(flowWithdrawalId);
      expect(body.status).toBe('requested');

      const count = await prisma.withdrawal.count({
        where: { creatorId: flowCreatorId },
      });
      expect(count).toBe(1);
    });

    it('409: ya existe un retiro en proceso', async () => {
      const res = await request(app.getHttpServer())
        .post(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${flowToken}`)
        .send({ amount: 100, clientRequestId: `flow-2-${SUFFIX}` })
        .expect(409);

      expect((res.body as { message: string }).message).toBe(
        'Ya existe un retiro en proceso',
      );
    });

    it('400: saldo insuficiente y no crea registro', async () => {
      const res = await request(app.getHttpServer())
        .post(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${poorToken}`)
        .send({ amount: 2000, clientRequestId: `poor-1-${SUFFIX}` })
        .expect(400);

      expect((res.body as { message: string }).message).toBe(
        'Saldo insuficiente para solicitar el retiro',
      );
      const count = await prisma.withdrawal.count({
        where: { creatorId: poorCreatorId },
      });
      expect(count).toBe(0);
    });

    it('409: una creadora con retiro sembrado no puede solicitar otro', async () => {
      const res = await request(app.getHttpServer())
        .post(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${busyToken}`)
        .send({ amount: 100, clientRequestId: `busy-1-${SUFFIX}` })
        .expect(409);

      expect((res.body as { message: string }).message).toBe(
        'Ya existe un retiro en proceso',
      );
    });

    it('401: sin token JWT', async () => {
      await request(app.getHttpServer())
        .post(`${PREFIX}/creators/me/withdrawals`)
        .send({ amount: 100, clientRequestId: `anon-${SUFFIX}` })
        .expect(401);
    });

    it('400: amount inválido (negativo) rechazado por el ValidationPipe', async () => {
      await request(app.getHttpServer())
        .post(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${poorToken}`)
        .send({ amount: -5, clientRequestId: `neg-${SUFFIX}` })
        .expect(400);
    });
  });

  describe('GET /creators/me/withdrawals (REQ-WD-3)', () => {
    it('200: lista solo los propios, orden createdAt desc', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${listToken}`)
        .expect(200);

      const rows = listRes.body as WithdrawalView[];
      const expectedIds = (
        global as unknown as { listIds?: string[] }
      ).listIds as string[];
      expect(rows.map((r) => r.id)).toEqual(expectedIds);
      for (const row of rows) {
        expect(row.creatorId).toBe(listCreatorId);
      }
    });

    it('200: el listado del flujo incluye su retiro y excluye el de otra creadora', async () => {
      const res = await request(app.getHttpServer())
        .get(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${flowToken}`)
        .expect(200);

      const rows = res.body as WithdrawalView[];
      expect(rows.some((r) => r.id === flowWithdrawalId)).toBe(true);
      expect(rows.every((r) => r.creatorId === flowCreatorId)).toBe(true);
    });

    it('401: sin token JWT', async () => {
      await request(app.getHttpServer())
        .get(`${PREFIX}/creators/me/withdrawals`)
        .expect(401);
    });
  });

  describe('PATCH /withdrawals/:id/status — admin (REQ-WD-4, REQ-WD-5)', () => {
    it('401: sin token de administración (fail-closed)', async () => {
      await request(app.getHttpServer())
        .patch(`${PREFIX}/withdrawals/${flowWithdrawalId}/status`)
        .send({ status: 'approved' })
        .expect(401);
    });

    it('401: token de administración inválido', async () => {
      await request(app.getHttpServer())
        .patch(`${PREFIX}/withdrawals/${flowWithdrawalId}/status`)
        .set('Authorization', 'Bearer token-invalido')
        .send({ status: 'approved' })
        .expect(401);
    });

    it('200: requested→approved y crea una Notification type=withdrawal', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${PREFIX}/withdrawals/${flowWithdrawalId}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'approved' })
        .expect(200);

      expect((res.body as WithdrawalView).status).toBe('approved');

      const notification = await prisma.notification.findFirst({
        where: { creatorId: flowCreatorId, type: 'withdrawal' },
      });
      expect(notification).not.toBeNull();
      expect(notification?.link).toContain(flowWithdrawalId);
    });

    it('400: paid sin evidencia desde un retiro approved (evidencia obligatoria)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${PREFIX}/withdrawals/${flowWithdrawalId}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'paid' })
        .expect(400);

      expect((res.body as { message: string }).message).toBe(
        'La evidencia es obligatoria para este estado',
      );
    });

    it('200: approved→paid con evidencia y notifica', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${PREFIX}/withdrawals/${flowWithdrawalId}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'paid', evidence: 'MP ref 123' })
        .expect(200);

      const body = res.body as WithdrawalView;
      expect(body.status).toBe('paid');
      expect(body.evidence).toBe('MP ref 123');

      const notifications = await prisma.notification.count({
        where: { creatorId: flowCreatorId, type: 'withdrawal' },
      });
      expect(notifications).toBe(2);
    });

    it('409: transición inválida (paid → approved)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${PREFIX}/withdrawals/${flowWithdrawalId}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'approved' })
        .expect(409);

      expect((res.body as { message: string }).message).toBe(
        'Transición de estado inválida',
      );
    });

    it('404: retiro inexistente', async () => {
      await request(app.getHttpServer())
        .patch(`${PREFIX}/withdrawals/${NON_EXISTENT_ID}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'approved' })
        .expect(404);
    });

    it('rejected libera saldo y notifica (REQ-WD-1, REQ-WD-4, REQ-WD-5)', async () => {
      const created = await request(app.getHttpServer())
        .post(`${PREFIX}/creators/me/withdrawals`)
        .set('Authorization', `Bearer ${rejectToken}`)
        .send({ amount: 500, clientRequestId: `reject-1-${SUFFIX}` })
        .expect(201);

      const afterCreate = await request(app.getHttpServer())
        .get(`${PREFIX}/creators/me/withdrawals/balance`)
        .set('Authorization', `Bearer ${rejectToken}`)
        .expect(200);
      expect((afterCreate.body as BalanceView).amountCents).toBe(43000);

      await request(app.getHttpServer())
        .patch(`${PREFIX}/withdrawals/${(created.body as WithdrawalView).id}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'rejected', evidence: 'No corresponde' })
        .expect(200);

      const afterReject = await request(app.getHttpServer())
        .get(`${PREFIX}/creators/me/withdrawals/balance`)
        .set('Authorization', `Bearer ${rejectToken}`)
        .expect(200);
      expect((afterReject.body as BalanceView).amountCents).toBe(93000);

      const notification = await prisma.notification.findFirst({
        where: { creatorId: rejectCreatorId, type: 'withdrawal' },
      });
      expect(notification).not.toBeNull();
    });
  });

  describe('Concurrencia real (D7) — Promise.all', () => {
    it('dos POST simultáneos distintos clientRequestId → exactamente 1×201 + 1×409', async () => {
      const post = (clientRequestId: string) =>
        request(app.getHttpServer())
          .post(`${PREFIX}/creators/me/withdrawals`)
          .set('Authorization', `Bearer ${concurrencyToken}`)
          .send({ amount: 500, clientRequestId });

      const [a, b] = await Promise.all([
        post(`conc-a-${SUFFIX}`),
        post(`conc-b-${SUFFIX}`),
      ]);

      expect([a.status, b.status].sort()).toEqual([201, 409]);

      const rows = await prisma.withdrawal.findMany({
        where: { creatorId: concurrencyCreatorId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('requested');
    });

    it('mismo clientRequestId simultáneo → 1×201 + 1×200 con el mismo id', async () => {
      const sameId = `replay-conc-${SUFFIX}`;
      const post = () =>
        request(app.getHttpServer())
          .post(`${PREFIX}/creators/me/withdrawals`)
          .set('Authorization', `Bearer ${replayToken}`)
          .send({ amount: 500, clientRequestId: sameId });

      const [a, b] = await Promise.all([post(), post()]);

      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect((a.body as WithdrawalView).id).toBe(
        (b.body as WithdrawalView).id,
      );

      const rows = await prisma.withdrawal.findMany({
        where: { creatorId: replayCreatorId },
      });
      expect(rows).toHaveLength(1);
    });
  });
});
