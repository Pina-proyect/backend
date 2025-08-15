import { Test, TestingModule } from '@nestjs/testing';
import { KycProviderService } from './kycprovider.service';
import type { Creator } from '@prisma/client';

describe('KycProviderService', () => {
  let service: KycProviderService;

  beforeAll(() => {
    jest.useFakeTimers(); // modern fake timers
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KycProviderService],
    }).compile();

    service = module.get<KycProviderService>(KycProviderService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debería devolver "verified" cuando el DNI termina en número par', async () => {
    const creator = { nationalId: '12345678' } as unknown as Creator; // termina en 8 (par)

    const promise = service.verifyDocuments(creator);

    // opcional: hay 1 timer pendiente
    expect(jest.getTimerCount()).toBe(1);

    // Avanzamos 2000ms y resolvemos timers async
    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBe('verified');
  });

  it('debería devolver "rejected" cuando el DNI termina en número impar', async () => {
    const creator = { nationalId: '987654321' } as unknown as Creator; // termina en 1 (impar)

    const promise = service.verifyDocuments(creator);
    expect(jest.getTimerCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBe('rejected');
  });

  it('debería devolver "rejected" cuando el último carácter NO es numérico', async () => {
    const creator = { nationalId: 'ABC12345X' } as unknown as Creator; // parseInt('X') => NaN

    const promise = service.verifyDocuments(creator);
    expect(jest.getTimerCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBe('rejected');
  });
});
