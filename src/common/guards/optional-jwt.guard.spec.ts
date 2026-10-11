import { UnauthorizedException } from '@nestjs/common';
import type { Creator } from '@prisma/client';
import { OptionalJwtAuthGuard } from './optional-jwt.guard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  const user = { id: 'user-1', email: 'a@b.com' } as unknown as Creator;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('debe estar definido', () => {
    expect(guard).toBeDefined();
  });

  it('devuelve el usuario cuando el token es válido', () => {
    // Passport entrega user con err=null; el guard NUNCA debe descartarlo.
    const result = guard.handleRequest(null, user);
    expect(result).toBe(user);
  });

  it('devuelve null (sin lanzar) cuando no hay token', () => {
    // Token ausente: passport entrega user=false y err=null.
    const result = guard.handleRequest(null, false as unknown as Creator);
    expect(result).toBeNull();
  });

  it('devuelve null (sin 401) cuando el token está expirado o corrupto', () => {
    const result = guard.handleRequest(
      new UnauthorizedException('jwt expired'),
      false as unknown as Creator,
    );
    expect(result).toBeNull();
  });

  it('devuelve null cuando hay error pero passport no resolvió usuario', () => {
    const result = guard.handleRequest(
      new Error('jwt malformed'),
      undefined as unknown as Creator,
    );
    expect(result).toBeNull();
  });
});
