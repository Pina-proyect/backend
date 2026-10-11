import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../prisma/prisma.service';
import { StorageProvider } from './../src/modules/storage/storage.provider';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';
import { MulterErrorFilter } from './../src/common/filters/multer-error.filter';

/**
 * E2E de hardening de entrega de media (v1.25):
 * - REQ-SVD-3: ningún endpoint público filtra el object key de un video privado.
 * - REQ-UL-2/3: upload con mime inválido → 415; sobredimensionado → 413; sin escritura.
 *
 * Harness: AppModule real + Postgres real (DATABASE_URL). Requiere DB accesible;
 * ver `test/jest-e2e.json` y `docker-compose.yml` (postgres:15 en localhost:5432).
 */

const PREFIX = '/api/pina';
const RAW_VIDEO_KEY = 'media/e2e-private-video.mp4';
const PUBLIC_IMAGE_URL = 'https://cdn.example.com/e2e-cover.jpg';
const CREATOR_EMAIL = 'e2e-media-creator@test.com';
const VIEWER_EMAIL = 'e2e-media-viewer@test.com';
const CREATOR_SLUG = 'e2e-media-creator';

interface MediaView {
  type: string;
  url: string;
  expiresAt?: string;
}

interface PackView {
  media: MediaView[];
}

describe('Media delivery hardening (e2e) — REQ-SVD-3, REQ-UL-2/3', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageProvider;
  let token: string;
  let creatorId: string;
  let viewerId: string;
  let packId: string;
  let categoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/pina');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    // Mismos filtros globales que main.ts (415/413 preservados tal cual).
    app.useGlobalFilters(new GlobalExceptionFilter(app.get(ConfigService)));
    app.useGlobalFilters(new MulterErrorFilter());
    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get(StorageProvider);

    const creator = await prisma.creator.create({
      data: {
        email: CREATOR_EMAIL,
        fullName: 'E2E Media Creator',
        password: null,
        birthDate: new Date('1990-01-01'),
        provider: 'credentials',
        role: 'CREATOR',
        slug: CREATOR_SLUG,
        verificationStatus: 'verified',
      },
    });
    creatorId = creator.id;

    const viewer = await prisma.creator.create({
      data: {
        email: VIEWER_EMAIL,
        fullName: 'E2E Media Viewer',
        password: null,
        birthDate: new Date('1990-01-01'),
        provider: 'credentials',
        role: 'CONSUMER',
      },
    });
    viewerId = viewer.id;

    const category = await prisma.category.create({
      data: { name: 'e2e-media-cat' },
    });
    categoryId = category.id;

    const pack = await prisma.contentPack.create({
      data: {
        title: 'Pack E2E Media',
        creatorId,
        categoryId,
        status: 'active',
      },
    });
    packId = pack.id;

    // Video privado (object key crudo, lo que NO debe filtrarse) + portada pública.
    await prisma.media.create({
      data: {
        creatorId,
        title: 'video privado',
        url: RAW_VIDEO_KEY,
        type: 'video',
        mimetype: 'video/mp4',
        size: 1024,
        isPrivate: true,
        packs: { connect: { id: packId } },
      },
    });
    await prisma.media.create({
      data: {
        creatorId,
        title: 'portada',
        url: PUBLIC_IMAGE_URL,
        type: 'image',
        mimetype: 'image/jpeg',
        size: 2048,
        isPrivate: false,
        packs: { connect: { id: packId } },
      },
    });

    // El viewer sigue al creator para que GET /feed devuelva el pack.
    await prisma.follow.create({
      data: { followerId: viewerId, followingId: creatorId },
    });

    const secret = process.env.JWT_SECRET ?? 'test-secret';
    token = jwt.sign({ sub: viewerId, email: VIEWER_EMAIL }, secret, {
      expiresIn: '15m',
    });
  });

  afterAll(async () => {
    // Si beforeAll no llegó a inicializar (p. ej. DB caída), no intentamos limpiar.
    if (!prisma) return;
    await prisma.follow.deleteMany({
      where: { OR: [{ followerId: viewerId }, { followingId: creatorId }] },
    });
    await prisma.media.deleteMany({ where: { creatorId } });
    await prisma.contentPack.deleteMany({ where: { id: packId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.creator.deleteMany({
      where: { email: { in: [CREATOR_EMAIL, VIEWER_EMAIL] } },
    });
    await app.close();
  });

  it('GET /packs/public/:slug no filtra el object key de video privado; portada pública intacta', async () => {
    const res = await request(app.getHttpServer())
      .get(`${PREFIX}/packs/public/${CREATOR_SLUG}`)
      .expect(200);

    const packs = res.body as PackView[];
    expect(packs.length).toBe(1);
    const video = packs[0].media.find((m) => m.type === 'video');
    const image = packs[0].media.find((m) => m.type === 'image');

    // Proyección pública: video blanqueado, imagen passthrough.
    expect(video?.url).toBe('');
    expect(image?.url).toBe(PUBLIC_IMAGE_URL);
    // Ningún campo de la respuesta contiene el key crudo.
    expect(JSON.stringify(res.body)).not.toContain(RAW_VIDEO_KEY);
  });

  it('GET /feed (autenticado) aplica proyección pública y no filtra el key', async () => {
    const res = await request(app.getHttpServer())
      .get(`${PREFIX}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const packs = res.body as PackView[];
    expect(packs.length).toBe(1);
    const video = packs[0].media.find((m) => m.type === 'video');

    expect(video?.url).toBe('');
    expect(JSON.stringify(res.body)).not.toContain(RAW_VIDEO_KEY);
  });

  it('POST /media/upload con mime inválido → 415 sin escritura', async () => {
    const uploadSpy = jest.spyOn(storage, 'upload');
    const before = await prisma.media.count({ where: { creatorId } });

    await request(app.getHttpServer())
      .post(`${PREFIX}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      })
      .expect(415);

    expect(uploadSpy).not.toHaveBeenCalled();
    const after = await prisma.media.count({ where: { creatorId } });
    expect(after).toBe(before);
    uploadSpy.mockRestore();
  });

  it('POST /media/upload imagen sobredimensionada (>10MB) → 413 sin escritura', async () => {
    const uploadSpy = jest.spyOn(storage, 'upload');
    const before = await prisma.media.count({ where: { creatorId } });
    const oversized = Buffer.alloc(11 * 1024 * 1024, 0);

    await request(app.getHttpServer())
      .post(`${PREFIX}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'imagen grande')
      .attach('file', oversized, {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);

    expect(uploadSpy).not.toHaveBeenCalled();
    const after = await prisma.media.count({ where: { creatorId } });
    expect(after).toBe(before);
    uploadSpy.mockRestore();
  });
});
