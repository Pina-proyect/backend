import { runBackfill } from '../../../scripts/backfill-access-type';

/**
 * Spec del backfill de normalización `Access.type 'PACK' → 'purchase'`
 * (spec packs-unlock, requirement "Backfill de datos"). Se testea la función
 * pura con un cliente mockeado (superficie mínima de Prisma): sin DB.
 */
describe('backfill-access-type', () => {
  const clientMock = {
    access: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('normaliza solo type=PACK a purchase y reporta conteos antes/después', async () => {
    clientMock.access.count
      .mockResolvedValueOnce(3) // before
      .mockResolvedValueOnce(0); // after
    clientMock.access.updateMany.mockResolvedValue({ count: 3 });

    const result = await runBackfill(clientMock as never);

    expect(result).toEqual({ before: 3, updated: 3, after: 0 });
    expect(clientMock.access.updateMany).toHaveBeenCalledWith({
      where: { type: 'PACK' },
      data: { type: 'purchase' },
    });
  });

  it('deja intactos purchase/gift/subscription (where acotado a PACK)', async () => {
    clientMock.access.count.mockResolvedValue(0);
    clientMock.access.updateMany.mockResolvedValue({ count: 0 });

    await runBackfill(clientMock as never);

    // Un único updateMany cuyo where solo selecciona type='PACK': los demás
    // tipos jamás entran en el set de datos.
    expect(clientMock.access.updateMany).toHaveBeenCalledTimes(1);
    expect(clientMock.access.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: 'PACK' },
        data: { type: 'purchase' },
      }),
    );
  });

  it('es re-ejecutable (idempotente): con 0 filas PACK no falla', async () => {
    clientMock.access.count.mockResolvedValue(0);
    clientMock.access.updateMany.mockResolvedValue({ count: 0 });

    await expect(runBackfill(clientMock as never)).resolves.toEqual({
      before: 0,
      updated: 0,
      after: 0,
    });
  });
});