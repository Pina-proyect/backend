import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from './../src/app.module';
import { AiProviderService } from './../src/modules/ai/services/ai-provider.service';
import { PrismaService } from './../prisma/prisma.service';

/** Respuesta esperada de POST /ai/profile/analyze. */
interface AnalyzeResponse {
  case: string;
  suggestions?: { suggestedNiche?: string };
  provider?: string;
  tokenUsage?: { total: number };
  degraded?: boolean;
}

/** Respuesta esperada de POST /ai/onboarding/ideas. */
interface IdeasResponse {
  content?: string;
}

describe('AI Onboarding (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiProviderService)
      .useValue({
        analyze: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            case: 'A',
            suggestedNiche: 'Fotografía',
            suggestedBio: 'Bio sugerida',
            suggestedGoal: { title: 'Meta', amount: 1000, currency: 'ARS' },
            suggestedPlan: ['Post 1', 'Post 2'],
            language: 'es',
          }),
          provider: 'groq',
          model: 'llama-3.1-8b-instant',
        }),
        chat: jest.fn().mockResolvedValue({
          content: 'Idea generada',
          provider: 'groq',
          model: 'llama-3.1-8b-instant',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/pina');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    // Crea un creator de prueba real para que el JwtStrategy lo encuentre.
    const creator = await prisma.creator.create({
      data: {
        email: 'e2e-ai@test.com',
        fullName: 'E2E AI',
        password: null,
        birthDate: new Date('1990-01-01'),
        provider: 'credentials',
        role: 'CREATOR',
      },
    });
    const secret = process.env.JWT_SECRET ?? 'test-secret';
    authToken = jwt.sign({ sub: creator.id, email: creator.email }, secret, {
      expiresIn: '15m',
    });
  });

  afterAll(async () => {
    await prisma.creator.deleteMany({ where: { email: 'e2e-ai@test.com' } });
    await app.close();
  });

  it('GET /api/pina/ai/insights sin token → 401', async () => {
    await request(app.getHttpServer()).get('/api/pina/ai/insights').expect(401);
  });

  it('POST /api/pina/ai/profile/analyze sin token → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/pina/ai/profile/analyze')
      .send({})
      .expect(401);
  });

  it('POST /api/pina/ai/profile/analyze sin consentimiento → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/pina/ai/profile/analyze')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ socialLinks: [] })
      .expect(400);
  });

  it('POST /api/pina/ai/onboarding/ideas con DTO inválido → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/pina/ai/onboarding/ideas')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ case: 'Z', stepIndex: 'abc' })
      .expect(400);
  });

  it('POST /api/pina/ai/profile/analyze happy path caso A → 200 con sugerencias y persiste Creator', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/pina/ai/profile/analyze')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        consent: true,
        socialLinks: [
          {
            platform: 'youtube',
            url: 'https://youtube.com/@e2e',
            followers: 5000,
          },
        ],
        country: 'AR',
        language: 'es',
      })
      .expect(200);
    const body = res.body as AnalyzeResponse;

    expect(body.case).toBe('A');
    expect(body.suggestions?.suggestedNiche).toBe('Fotografía');
    expect(body.provider).toBe('groq');
    expect(body.tokenUsage?.total).toBeGreaterThanOrEqual(0);

    // REQ-INS-2: el análisis completó → Creator tiene aiLastAnalyzedAt y aiSuggestedNiche.
    const creator = await prisma.creator.findUnique({
      where: { email: 'e2e-ai@test.com' },
    });
    expect(creator?.aiLastAnalyzedAt).toBeTruthy();
    expect(creator?.aiSuggestedNiche).toBe('Fotografía');

    // El insight quedó con metadata real.
    const insight = await prisma.creatorInsight.findFirst({
      where: { creatorId: creator?.id, type: 'onboarding' },
      orderBy: { createdAt: 'desc' },
    });
    expect(insight?.metadata).toMatchObject({
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
    });
  });

  it('POST /api/pina/ai/onboarding/ideas happy path caso C → 200 con contenido', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/pina/ai/onboarding/ideas')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ case: 'C', stepIndex: '1', answers: ['Fotografía'] })
      .expect(200);
    const body = res.body as IdeasResponse;
    expect(body.content).toBe('Idea generada');
  });

  it('GET /api/pina/ai/insights con token → 200 y lista historial', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/pina/ai/insights')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    const body = res.body as unknown[];
    expect(Array.isArray(body)).toBe(true);
    // Debe incluir al menos el insight del happy path.
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/pina/auth/profile acepta aiPlanAccepted → 200 y actualiza Creator', async () => {
    await request(app.getHttpServer())
      .patch('/api/pina/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ aiPlanAccepted: true })
      .expect(200);
    const creator = await prisma.creator.findUnique({
      where: { email: 'e2e-ai@test.com' },
    });
    expect(creator?.aiPlanAccepted).toBe(true);
  });

  it('POST /api/pina/ai/profile/analyze con provider caído → 200 caso D degraded (sin keys simuladas)', async () => {
    // Sin GROQ/DEEPSEEK en env, el provider mock devuelve error → router degrada a D.
    const provider = app.get(AiProviderService);
    (provider.analyze as jest.Mock).mockRejectedValueOnce(
      new Error('Provider caído'),
    );
    const res = await request(app.getHttpServer())
      .post('/api/pina/ai/profile/analyze')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        consent: true,
        socialLinks: [
          {
            platform: 'youtube',
            url: 'https://youtube.com/@e2e',
            followers: 5000,
          },
        ],
        language: 'es',
      })
      .expect(200);
    const body = res.body as AnalyzeResponse;
    expect(body.case).toBe('D');
    expect(body.degraded).toBe(true);
  });
});
