import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WithdrawalsAdminGuard } from './withdrawals-admin.guard';

/**
 * Guard de administración de retiros (v1.27, D5): Bearer timing-safe y
 * fail-closed si `WITHDRAWALS_ADMIN_TOKEN` está vacío. Tests proveen el
 * token directamente vía ConfigService mock (no dependen del .env dev).
 */
describe('WithdrawalsAdminGuard', () => {
  let guard: WithdrawalsAdminGuard;
  const TOKEN = 'super-secret-admin-token-1234567890';
  let configGet: jest.Mock;

  const context = (authorization?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authorization ? { authorization } : {},
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    configGet = jest.fn().mockReturnValue(TOKEN);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsAdminGuard,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    guard = module.get<WithdrawalsAdminGuard>(WithdrawalsAdminGuard);
  });

  it('permite el acceso con el token correcto', () => {
    expect(guard.canActivate(context(`Bearer ${TOKEN}`))).toBe(true);
  });

  it('rechaza con 401 si falta el header Authorization', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });

  it('rechaza con 401 si el esquema no es Bearer', () => {
    expect(() => guard.canActivate(context(`Basic ${TOKEN}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza con 401 si el token es incorrecto', () => {
    expect(() =>
      guard.canActivate(context('Bearer token-incorrecto-1234567890')),
    ).toThrow(UnauthorizedException);
  });

  it('rechaza con 401 sin romper timingSafeEqual cuando la longitud difiere', () => {
    expect(() => guard.canActivate(context('Bearer corto'))).toThrow(
      UnauthorizedException,
    );
  });

  it('fail-closed: rechaza con 401 si WITHDRAWALS_ADMIN_TOKEN está vacío', () => {
    configGet.mockReturnValue('');
    expect(() => guard.canActivate(context(`Bearer ${TOKEN}`))).toThrow(
      UnauthorizedException,
    );
  });
});
