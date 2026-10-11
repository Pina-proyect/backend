import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from 'prisma/prisma.service';

/**
 * Spec del flujo PACK del webhook de Mercado Pago (spec packs-unlock):
 * el Access se crea con `type='purchase'` (normalizado; antes escribía 'PACK'),
 * la idempotencia se preserva vía `findFirst` y el flujo DONATION queda intacto.
 * `fetch` (GET /v1/payments/:id de MP) se mockea a nivel global.
 */
describe('PaymentsService — webhook flujo PACK (Access.type normalizado)', () => {
  let service: PaymentsService;

  const prismaMock = {
    creator: { findUnique: jest.fn() },
    donation: { findUnique: jest.fn(), update: jest.fn() },
    access: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const configMock = {
    get: jest.fn().mockReturnValue(''),
    getOrThrow: jest.fn().mockReturnValue('http://localhost:4011'),
  };

  const mockFetch = jest.fn();

  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterAll(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  afterEach(() => {
    // Limpia also la cola de implementaciones `once` de fetch entre tests.
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  /** Payload estándar de un payment PACK aprobado. */
  const packPaymentPayload = (overrides: Record<string, unknown> = {}) => ({
    id: 123456,
    status: 'approved',
    external_reference: JSON.stringify({ userId: 'user-1', packId: 'pack-1' }),
    ...overrides,
  });

  const mockMpResponse = (payload: unknown) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    });
  };

  it('crea un Access con type=purchase cuando el pago PACK está approved', async () => {
    mockMpResponse(packPaymentPayload());
    prismaMock.access.findFirst.mockResolvedValue(null);
    prismaMock.access.create.mockResolvedValue({ id: 'acc-1' });

    const result = await service.handleWebhook('payment', '123456');

    expect(result.received).toBe(true);
    expect(prismaMock.access.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', packId: 'pack-1' },
    });
    expect(prismaMock.access.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', packId: 'pack-1', type: 'purchase' },
    });
  });

  it('no crea un segundo Access si ya existe el par userId+packId (idempotencia)', async () => {
    mockMpResponse(packPaymentPayload());
    prismaMock.access.findFirst.mockResolvedValue({ id: 'acc-1' });

    const result = await service.handleWebhook('payment', '123456');

    expect(result.received).toBe(true);
    expect(prismaMock.access.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', packId: 'pack-1' },
    });
    expect(prismaMock.access.create).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'pending'])(
    'no crea Access cuando el pago está %s',
    async (status) => {
      mockMpResponse(packPaymentPayload({ status }));

      const result = await service.handleWebhook('payment', '123456');

      expect(result.received).toBe(true);
      expect(prismaMock.access.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.access.create).not.toHaveBeenCalled();
    },
  );

  it('deja intacto el flujo DONATION: no crea Access (actualiza la Donation)', async () => {
    mockMpResponse({
      id: 654321,
      status: 'approved',
      metadata: { donation_id: 'don-1' },
      external_reference: JSON.stringify({ type: 'DONATION' }),
    });
    prismaMock.donation.findUnique.mockResolvedValue({
      id: 'don-1',
      status: 'pending',
    });
    prismaMock.donation.update.mockResolvedValue({});

    const result = await service.handleWebhook('payment', '654321');

    expect(result.received).toBe(true);
    expect(prismaMock.donation.update).toHaveBeenCalled();
    expect(prismaMock.access.create).not.toHaveBeenCalled();
  });

  it('no crea Access cuando falta userId o packId en external_reference', async () => {
    mockMpResponse(packPaymentPayload({ external_reference: '{}' }));

    const result = await service.handleWebhook('payment', '123456');

    expect(result.received).toBe(true);
    expect(prismaMock.access.create).not.toHaveBeenCalled();
  });
});