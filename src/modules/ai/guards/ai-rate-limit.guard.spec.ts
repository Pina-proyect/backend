import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { CacheService } from '../../../common/cache/cache.service';

describe('AiRateLimitGuard (5/día por usuario)', () => {
  let guard: AiRateLimitGuard;
  let cacheGet: jest.Mock;
  let cacheSet: jest.Mock;

  const config = {
    get: jest.fn((k: string) => (k === 'AI_DAILY_LIMIT' ? 5 : undefined)),
  };

  beforeEach(async () => {
    cacheGet = jest.fn();
    cacheSet = jest.fn();
    const cache = { get: cacheGet, set: cacheSet } as unknown as CacheService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRateLimitGuard,
        { provide: CacheService, useValue: cache },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    guard = module.get<AiRateLimitGuard>(AiRateLimitGuard);
  });

  const ctx = (userId: string | undefined): any => ({
    switchToHttp: (): any => ({
      getRequest: (): any => ({ user: userId ? { id: userId } : undefined }),
    }),
  });

  it('permite si el usuario está por debajo del límite e incrementa', async () => {
    cacheGet.mockResolvedValue(3);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
    expect(cacheSet).toHaveBeenCalledWith('ai:analyze:u1', 4, 86400);
  });

  it('lanza 429 si el usuario alcanzó el límite diario', async () => {
    cacheGet.mockResolvedValue(5);
    await expect(guard.canActivate(ctx('u1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('arranca en 1 si no hay conteo previo', async () => {
    cacheGet.mockResolvedValue(null);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
    expect(cacheSet).toHaveBeenCalledWith('ai:analyze:u1', 1, 86400);
  });
});
