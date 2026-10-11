import { envValidationSchema, R2_REQUIRED_VARS } from './config/env.validation';

/**
 * Contrato REQ-R2S-3: la validación de entorno del AppModule exige las variables
 * R2_* cuando el driver de storage es r2 y falla nombrando CADA faltante.
 * Con `local` (o sin definir en un entorno no-producción) permanecen opcionales.
 */
describe('AppModule — validación Joi condicional de R2_* (REQ-R2S-3)', () => {
  const BASE_ENV = {
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:4011/api/pina/auth/google/callback',
    FRONTEND_URL: 'http://localhost:3000',
  };

  function validate(overrides: Record<string, string> = {}) {
    return envValidationSchema.validate(
      { ...BASE_ENV, ...overrides },
      { abortEarly: false, allowUnknown: true },
    );
  }

  describe('STORAGE_DRIVER=r2', () => {
    it('falla y nombra TODAS las variables R2_* faltantes', () => {
      const { error } = validate({ STORAGE_DRIVER: 'r2' });

      expect(error).toBeDefined();
      for (const name of R2_REQUIRED_VARS) {
        expect(error?.message).toContain(name);
      }
      expect(error?.message).toContain(
        'Falta R2_ACCOUNT_ID (requerida con STORAGE_DRIVER=r2)',
      );
    });

    it('nombra solo las faltantes cuando algunas R2_* están presentes', () => {
      const { error } = validate({
        STORAGE_DRIVER: 'r2',
        R2_ACCOUNT_ID: 'account',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('R2_BUCKET');
      expect(error?.message).toContain('R2_PUBLIC_BUCKET');
      expect(error?.message).not.toContain('R2_ACCOUNT_ID');
      expect(error?.message).not.toContain('R2_ACCESS_KEY_ID');
    });
  });

  describe('STORAGE_DRIVER=local o sin definir', () => {
    it('arranca sin exigir R2_* con STORAGE_DRIVER=local', () => {
      const { error } = validate({ STORAGE_DRIVER: 'local' });

      expect(error).toBeUndefined();
    });

    it('permite R2_* opcionales con STORAGE_DRIVER=local explícito y NODE_ENV=production', () => {
      const { error } = validate({
        STORAGE_DRIVER: 'local',
        NODE_ENV: 'production',
      });

      expect(error).toBeUndefined();
    });

    it('permite R2_* opcionales sin STORAGE_DRIVER definido (default no-producción)', () => {
      const { error } = validate();

      expect(error).toBeUndefined();
    });
  });

  describe('default efectivo r2 en producción (verificado contra storageDriver())', () => {
    it('exige R2_* cuando NODE_ENV=production y STORAGE_DRIVER no está definido', () => {
      const { error } = validate({ NODE_ENV: 'production' });

      expect(error).toBeDefined();
      for (const name of R2_REQUIRED_VARS) {
        expect(error?.message).toContain(name);
      }
    });
  });
});
