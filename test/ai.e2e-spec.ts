import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from './../src/app.module';
import { AiProviderService } from './../src/modules/ai/services/ai-provider.service';
import { PrismaService } from './../prisma/prisma.service';
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
    authToken = jwt.sign(
      { sub: creator.id, email: creator.email },
      secret,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    await prisma.creator.deleteMany({ where: { email: 'e2e-ai@test.com' } });
    await app.close();
  });

  it('GET /api/pina/ai/insights sin token → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/pina/ai/insights')
      .expect(401);
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
});
