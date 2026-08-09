import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ProfileAnalyzerService } from './profile-analyzer.service';
import { AiProviderService } from './ai-provider.service';
import {
  SocialMetadataService,
  EnrichedSocial,
} from './social-metadata.service';
import { AnalyzeProfileDto } from '../dto/analyze-profile.dto';

describe('ProfileAnalyzerService (router A/B/C/D)', () => {
  let service: ProfileAnalyzerService;
  let providerAnalyze: jest.Mock;
  let socialsProcess: jest.Mock;

  const config = {
    get: jest.fn((k: string) =>
      k === 'AI_FOLLOWER_THRESHOLD' ? 1000 : undefined,
    ),
  };

  const richSocials: EnrichedSocial[] = [
    { platform: 'youtube', url: 'https://youtube.com/@test', followers: 5000 },
  ];
  const poorSocials: EnrichedSocial[] = [
    {
      platform: 'instagram',
      url: 'https://instagram.com/test',
      followers: 200,
    },
  ];

  beforeEach(async () => {
    providerAnalyze = jest.fn();
    socialsProcess = jest.fn();
    const provider = {
      analyze: providerAnalyze,
      chat: jest.fn(),
    } as unknown as AiProviderService;
    const socials = {
      process: socialsProcess,
    } as unknown as SocialMetadataService;
    const prisma = {
      creatorInsight: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileAnalyzerService,
        { provide: AiProviderService, useValue: provider },
        { provide: SocialMetadataService, useValue: socials },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<ProfileAnalyzerService>(ProfileAnalyzerService);
  });

  const dto = (over: Partial<AnalyzeProfileDto> = {}): AnalyzeProfileDto => ({
    consent: true,
    socialLinks: [],
    ...over,
  });

  it('devuelve caso D si no hay consentimiento', async () => {
    const out = await service.analyze('u1', dto({ consent: false }));
    expect(out.case).toBe('D');
    expect(out.degraded).toBe(true);
  });

  it('devuelve caso C si no hay redes válidas', async () => {
    socialsProcess.mockResolvedValue([]);
    const out = await service.analyze('u1', dto());
    expect(out.case).toBe('C');
    expect(providerAnalyze).not.toHaveBeenCalled();
  });

  it('devuelve caso B si max followers < umbral', async () => {
    socialsProcess.mockResolvedValue(poorSocials);
    const out = await service.analyze('u1', dto());
    expect(out.case).toBe('B');
    expect(providerAnalyze).not.toHaveBeenCalled();
  });

  it('devuelve caso A con sugerencias si max followers >= umbral', async () => {
    socialsProcess.mockResolvedValue(richSocials);
    providerAnalyze.mockResolvedValue({
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
    });

    const out = await service.analyze('u1', dto());
    expect(out.case).toBe('A');
    expect(out.degraded).toBe(false);
    expect(out.suggestions?.suggestedNiche).toBe('Fotografía');
    expect(out.suggestions?.suggestedPlan).toHaveLength(2);
  });

  it('degrada a caso D si el provider lanza error', async () => {
    socialsProcess.mockResolvedValue(richSocials);
    providerAnalyze.mockRejectedValue(new Error('Provider caído'));

    const out = await service.analyze('u1', dto());
    expect(out.case).toBe('D');
    expect(out.degraded).toBe(true);
  });

  it('degrada a caso D si el JSON no valida el schema (anti-alucinación)', async () => {
    socialsProcess.mockResolvedValue(richSocials);
    providerAnalyze.mockResolvedValue({
      content: JSON.stringify({ case: 'A', nonsense: true }),
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
    });

    const out = await service.analyze('u1', dto());
    expect(out.case).toBe('D');
    expect(out.degraded).toBe(true);
  });
});
