import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../prisma/prisma.service';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

/**
 * E2E de packs CRUD + unlock (specs packs-crud y packs-unlock):
 * - PATCH /packs/:id: 200 owner, 403 no-owner, 404 inexistente/archivado, 400 body vacío, 401 sin token.
 * - DELETE /packs/:id: 204 soft-delete idempotente, 403 no-owner, 404 inexistente.
 * - GET /packs/:id: hasAccess false anónimo, true comprador/propietario, false sin acceso,
 *   token inválido → anónimo, 404 si archivado.
 *
 * Harness: AppModule real + Postgres real (DATABASE_URL) + Redis; ver `test/jest-e2e.json`.
 */

const PREFIX = '/api/pina';
const SUFFIX = Date.now().toString(36);
const OWNER_EMAIL = `e2e-packs-owner-${SUFFIX}@test.com`;
const BUYER_EMAIL = `e2e-packs-buyer-${SUFFIX}@test.com`;
const STRANGER_EMAIL = `e2e-packs-stranger-${SUFFIX}@test.com`;
const CATEGORY_NAME = `e2e-packs-cat-${SUFFIX}`;
const NON_EXISTENT_ID = '00000000-0000-4000-8000-000000000000';

interface PackView {
  id: string;
  title: string;
  hasAccess?: boolean;
  media?: unknown[];
  category?: unknown;
}

describe('Packs CRUD + unlock (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let buyerToken: string;
  let strangerToken: string;
  let ownerId: string;
  let buyerId: string;
  let strangerId: string;
  let categoryId: string;
  let packId: string;
  let archivedPackId: string;
  let deletePackId: string;

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

    const owner = await prisma.creator.create({
      data: {
        email: OWNER_EMAIL,
        fullName: 'E2E Packs Owner',
        password: null,
        birthDate: new Date('1990-01-01'),
        provider: 'credentials',
        role: 'CREATOR',
        verificationStatus: 'verified',
      },
    });
    ownerId = owner.id;

    const buyer = await prisma.creator.create({
      data: {
        email: BUYER_EMAIL,
        fullName: 'E2E Packs Buyer',
        password: null,
        birthDate: new Date('1990-01-01'),
        provider: 'credentials',
        role: 'CONSUMER',
      },
    });
    buyerId = buyer.id;

    const stranger = await prisma.creator.create({
      data: {
        email: STRANGER_EMAIL,
        fullName: 'E2E Packs Stranger',
        password: null,
        birthDate: new Date('1990-01-01'),
        provider: 'credentials',
        role: 'CONSUMER',
      },
    });
    strangerId = stranger.id;

    const category = await prisma.category.create({
      data: { name: CATEGORY_NAME },
    });
    categoryId = category.id;

    const pack = await prisma.contentPack.create({
      data: {
        title: 'Pack E2E Activo',
        creatorId: ownerId,
        categoryId,
        status: 'active',
      },
    });
    packId = pack.id;

    const archived = await prisma.contentPack.create({
      data: {
        title: 'Pack E2E Archivado',
        creatorId: ownerId,
        categoryId,
        status: 'archived',
      },
    });
    archivedPackId = archived.id;

    const toDelete = await prisma.contentPack.create({
      data: {
        title: 'Pack E2E a Borrar',
        creatorId: ownerId,
        categoryId,
        status: 'active',
      },
    });
    deletePackId = toDelete.id;

    // El buyer compró el pack principal → contrato unlock (Access).
    await prisma.access.create({
      data: { userId: buyerId, packId, type: 'purchase' },
    });

    const secret = process.env.JWT_SECRET ?? 'test-secret';
    const sign = (sub: string, email: string) =>
      jwt.sign({ sub, email }, secret, { expiresIn: '15m' });
    ownerToken = sign(ownerId, OWNER_EMAIL);
    buyerToken = sign(buyerId, BUYER_EMAIL);
    strangerToken = sign(strangerId, STRANGER_EMAIL);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.access.deleteMany({ where: { userId: buyerId } });
    await prisma.contentPack.deleteMany({ where: { creatorId: ownerId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.creator.deleteMany({
      where: { email: { in: [OWNER_EMAIL, BUYER_EMAIL, STRANGER_EMAIL] } },
    });
    await app.close();
  });

  describe('PATCH /packs/:id', () => {
    it('200: el propietario edita título y precio (incluye media y category)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${PREFIX}/packs/${packId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Pack E2E Renombrado', price: 12.5 })
        .expect(200);

      const body = res.body as PackView;
      expect(body.id).toBe(packId);
      expect(body.title).toBe('Pack E2E Renombrado');
      expect(body.media).toBeDefined();
      expect(body.category).toBeDefined();
    });

    it('403: un usuario que no es el propietario no puede editar', async () => {
      await request(app.getHttpServer())
        .patch(`${PREFIX}/packs/${packId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ title: 'Intento ajeno' })
        .expect(403);
    });

    it('404: el pack no existe', async () => {
      await request(app.getHttpServer())
        .patch(`${PREFIX}/packs/${NON_EXISTENT_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'x' })
        .expect(404);
    });

    it('404: un pack archivado no se puede editar', async () => {
      await request(app.getHttpServer())
        .patch(`${PREFIX}/packs/${archivedPackId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'x' })
        .expect(404);
    });

    it('400: body sin ningún campo del DTO', async () => {
      await request(app.getHttpServer())
        .patch(`${PREFIX}/packs/${packId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(400);
    });

    it('401: sin token', async () => {
      await request(app.getHttpServer())
        .patch(`${PREFIX}/packs/${packId}`)
        .send({ title: 'x' })
        .expect(401);
    });
  });

  describe('DELETE /packs/:id', () => {
    it('204: el propietario archiva su pack (soft-delete)', async () => {
      await request(app.getHttpServer())
        .delete(`${PREFIX}/packs/${deletePackId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      const pack = await prisma.contentPack.findUnique({
        where: { id: deletePackId },
      });
      expect(pack?.status).toBe('archived');
    });

    it('204: DELETE repetido es idempotente', async () => {
      await request(app.getHttpServer())
        .delete(`${PREFIX}/packs/${deletePackId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });

    it('403: un usuario que no es el propietario no puede borrar', async () => {
      await request(app.getHttpServer())
        .delete(`${PREFIX}/packs/${packId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(403);
    });

    it('404: el pack no existe', async () => {
      await request(app.getHttpServer())
        .delete(`${PREFIX}/packs/${NON_EXISTENT_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  describe('GET /packs/:id — hasAccess', () => {
    it('200 hasAccess=false: usuario anónimo (sin token)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${PREFIX}/packs/${packId}`)
        .expect(200);

      const body = res.body as PackView;
      expect(body.hasAccess).toBe(false);
      expect(body.media).toBeDefined();
    });

    it('200 hasAccess=true: comprador con registro Access', async () => {
      const res = await request(app.getHttpServer())
        .get(`${PREFIX}/packs/${packId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect((res.body as PackView).hasAccess).toBe(true);
    });

    it('200 hasAccess=true: propietario autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get(`${PREFIX}/packs/${packId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect((res.body as PackView).hasAccess).toBe(true);
    });

    it('200 hasAccess=false: autenticado sin Access ni ownership', async () => {
      const res = await request(app.getHttpServer())
        .get(`${PREFIX}/packs/${packId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(200);

      expect((res.body as PackView).hasAccess).toBe(false);
    });

    it('200 hasAccess=false: token inválido se trata como anónimo (sin 401)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${PREFIX}/packs/${packId}`)
        .set('Authorization', 'Bearer token-invalido')
        .expect(200);

      expect((res.body as PackView).hasAccess).toBe(false);
    });

    it('404: pack archivado', async () => {
      await request(app.getHttpServer())
        .get(`${PREFIX}/packs/${archivedPackId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
});