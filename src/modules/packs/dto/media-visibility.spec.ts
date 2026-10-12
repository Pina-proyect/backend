import { isValidMediaVisibility } from './media-visibility';

/**
 * Contrato del mapa de visibilidad por media (REQ-SVD-3, D3):
 * `mediaVisibility?: Record<mediaId, 'preview' | 'exclusive'>`, aditivo y
 * opcional. Los valores fuera del dominio se rechazan en el borde (DTO).
 */
describe('isValidMediaVisibility', () => {
  it('acepta un mapa con valores del dominio', () => {
    expect(isValidMediaVisibility({ m1: 'preview', m2: 'exclusive' })).toBe(
      true,
    );
  });

  it('acepta un mapa vacío (visibilidad opcional)', () => {
    expect(isValidMediaVisibility({})).toBe(true);
  });

  it('rechaza un valor de visibilidad desconocido', () => {
    expect(isValidMediaVisibility({ m1: 'public' })).toBe(false);
  });

  it('rechaza claves cuyo valor no es string del dominio', () => {
    expect(isValidMediaVisibility({ m1: 'preview', m2: 42 })).toBe(false);
  });

  it('rechaza no-objetos (string, null, array)', () => {
    expect(isValidMediaVisibility('exclusive')).toBe(false);
    expect(isValidMediaVisibility(null)).toBe(false);
    expect(isValidMediaVisibility(['preview'])).toBe(false);
  });
});
