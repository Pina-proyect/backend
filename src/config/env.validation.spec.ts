import * as Joi from 'joi';
import { envValidationSchema } from './env.validation';

/**
 * Contrato de configuración de retiros (v1.27, D5):
 * - `WITHDRAWALS_ADMIN_TOKEN` opcional y `allow('')` (fail-closed en el guard).
 * - `WITHDRAWAL_MIN_AMOUNT` numérico con default 0 (sin mínimo en el MVP).
 */
interface WithdrawalsEnv {
  WITHDRAWAL_MIN_AMOUNT?: number;
  WITHDRAWALS_ADMIN_TOKEN?: string;
}

const baseEnv = {
  JWT_SECRET: 'test-secret',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/pina_test',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:4011/auth/google/callback',
  FRONTEND_URL: 'http://localhost:3000',
};

const validate = (
  env: Record<string, unknown>,
): Joi.ValidationResult<WithdrawalsEnv> => envValidationSchema.validate(env);

/** Valida y exige éxito; el narrowing del discriminante tipa el value. */
const expectValid = (env: Record<string, unknown>): WithdrawalsEnv => {
  const result = validate(env);
  if (result.error) {
    throw new Error(`env inválido: ${result.error.message}`);
  }
  return result.value;
};

describe('envValidationSchema — retiros (v1.27)', () => {
  it('aplica WITHDRAWAL_MIN_AMOUNT=0 por defecto cuando falta', () => {
    expect(expectValid(baseEnv).WITHDRAWAL_MIN_AMOUNT).toBe(0);
  });

  it('acepta un WITHDRAWAL_MIN_AMOUNT numérico y lo normaliza a number', () => {
    expect(
      expectValid({ ...baseEnv, WITHDRAWAL_MIN_AMOUNT: '500' })
        .WITHDRAWAL_MIN_AMOUNT,
    ).toBe(500);
  });

  it('rechaza un WITHDRAWAL_MIN_AMOUNT no numérico', () => {
    const { error } = validate({
      ...baseEnv,
      WITHDRAWAL_MIN_AMOUNT: 'no-es-numero',
    });

    expect(error).toBeDefined();
    expect(error?.details[0].path).toContain('WITHDRAWAL_MIN_AMOUNT');
    expect(error?.details[0].type).toBe('number.base');
  });

  it('acepta WITHDRAWALS_ADMIN_TOKEN vacío (fail-closed, sin token configurado)', () => {
    expect(
      expectValid({ ...baseEnv, WITHDRAWALS_ADMIN_TOKEN: '' })
        .WITHDRAWALS_ADMIN_TOKEN,
    ).toBe('');
  });

  it('acepta un WITHDRAWALS_ADMIN_TOKEN presente', () => {
    expect(
      expectValid({
        ...baseEnv,
        WITHDRAWALS_ADMIN_TOKEN: 'super-secret-admin-token',
      }).WITHDRAWALS_ADMIN_TOKEN,
    ).toBe('super-secret-admin-token');
  });
});
