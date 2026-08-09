import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiProviderService } from './ai-provider.service';
import { GroqProvider } from '../providers/groq.provider';
import { DeepSeekProvider } from '../providers/deepseek.provider';

describe('AiProviderService (fallback + circuit breaker)', () => {
  let service: AiProviderService;
  let groqAnalyze: jest.Mock;
  let groqChat: jest.Mock;
  let deepseekAnalyze: jest.Mock;
  let deepseekChat: jest.Mock;

  const config = {
    get: jest.fn((k: string) => {
      if (k === 'AI_CB_FAILURE_THRESHOLD') return 3;
      if (k === 'AI_CB_RESET_MS') return 30000;
      return undefined;
    }),
  };

  beforeEach(async () => {
    groqAnalyze = jest.fn();
    groqChat = jest.fn();
    deepseekAnalyze = jest.fn();
    deepseekChat = jest.fn();
    const groq = {
      name: 'groq',
      available: true,
      analyze: groqAnalyze,
      chat: groqChat,
    } as unknown as GroqProvider;
    const deepseek = {
      name: 'deepseek',
      available: true,
      analyze: deepseekAnalyze,
      chat: deepseekChat,
    } as unknown as DeepSeekProvider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProviderService,
        { provide: GroqProvider, useValue: groq },
        { provide: DeepSeekProvider, useValue: deepseek },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AiProviderService>(AiProviderService);
  });

  const payload = {
    niche: 'x',
    language: 'es',
    socials: [{ platform: 'youtube', url: 'https://youtube.com/@x' }],
  };

  it('usa Groq si está disponible', async () => {
    groqAnalyze.mockResolvedValue({ content: '{}', provider: 'groq', model: 'm' });
    const result = await service.analyze(payload);
    expect(result.provider).toBe('groq');
    expect(deepseekAnalyze).not.toHaveBeenCalled();
  });

  it('hace fallback a DeepSeek si Groq falla', async () => {
    groqAnalyze.mockRejectedValue(new Error('Groq down'));
    deepseekAnalyze.mockResolvedValue({ content: '{}', provider: 'deepseek', model: 'm' });
    const result = await service.analyze(payload);
    expect(result.provider).toBe('deepseek');
  });

  it('abre el circuit breaker tras N fallos consecutivos y rechaza', async () => {
    groqAnalyze.mockRejectedValue(new Error('down'));
    deepseekAnalyze.mockRejectedValue(new Error('down'));

    // 3 fallos consecutivos (cada llamada intenta groq+deepseek)
    for (let i = 0; i < 3; i++) {
      await expect(service.analyze(payload)).rejects.toThrow();
    }
    // Ahora el breaker está abierto → rechaza sin llamar a los providers
    await expect(service.analyze(payload)).rejects.toThrow(
      'Circuit breaker abierto',
    );
  });

  it('lanza error si no hay providers disponibles', async () => {
    // Acceso al estado interno para simular ausencia de providers.
    const internal = service as unknown as {
      groq: { available: boolean };
      deepseek: { available: boolean };
    };
    internal.groq = { available: false };
    internal.deepseek = { available: false };
    await expect(service.analyze(payload)).rejects.toThrow(
      'Ningún provider',
    );
  });
});
