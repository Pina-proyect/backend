import * as Joi from 'joi';

/**
 * Variables que el driver `r2` exige en el arranque (REQ-R2S-3).
 */
export const R2_REQUIRED_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BUCKET',
] as const;

/**
 * Schema Joi condicional (REQ-R2S-3).
 *
 * El driver efectivo es `r2` cuando `STORAGE_DRIVER=r2`, o cuando no hay
 * `STORAGE_DRIVER` explícito y `NODE_ENV=production` — mismo default que
 * `storageDriver()` en `app.module.ts`. En esos casos cada `R2_*` es
 * obligatoria y su mensaje nombra la variable faltante; con `local` (o en
 * cualquier entorno no-productivo) permanecen opcionales.
 */
function requiredWhenR2(varName: string) {
  const message = `Falta ${varName} (requerida con STORAGE_DRIVER=r2)`;
  const required = Joi.string().required().messages({
    'any.required': message,
    'string.empty': message,
  });
  const optional = Joi.string().optional().allow('');

  return Joi.when('STORAGE_DRIVER', {
    is: 'r2',
    then: required,
    otherwise: Joi.when('NODE_ENV', {
      is: 'production',
      then: Joi.when('STORAGE_DRIVER', {
        is: 'local',
        then: optional,
        otherwise: required,
      }),
      otherwise: optional,
    }),
  });
}

export const envValidationSchema = Joi.object({
  JWT_SECRET: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri({ allowRelative: true }).required(),
  PORT: Joi.number().default(4011),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(10),
  MP_ACCESS_TOKEN: Joi.string().optional().allow(''),
  MP_CLIENT_ID: Joi.string().optional().allow(''),
  MP_CLIENT_SECRET: Joi.string().optional().allow(''),
  MP_REDIRECT_URI: Joi.string().optional().allow(''),
  MP_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  NGROK_URL: Joi.string().optional().allow(''),
  BACKEND_URL: Joi.string().optional().allow(''),
  CORS_ORIGINS: Joi.string().optional().allow(''),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  REDIS_URL: Joi.string().uri().optional().allow(''),
  RESEND_API_KEY: Joi.string().optional().allow(''),
  EMAIL_FROM: Joi.string().optional().allow(''),
  // ── AI Onboarding (v1.18) ──────────────────────────────
  GROQ_API_KEY: Joi.string().optional().allow(''),
  DEEPSEEK_API_KEY: Joi.string().optional().allow(''),
  YOUTUBE_API_KEY: Joi.string().optional().allow(''),
  AI_FOLLOWER_THRESHOLD: Joi.number().default(1000),
  AI_DAILY_LIMIT: Joi.number().default(5),
  AI_MONTHLY_BUDGET_USD: Joi.number().optional().allow(''),
  AI_CB_FAILURE_THRESHOLD: Joi.number().default(3),
  AI_CB_RESET_MS: Joi.number().default(30000),
  // ── Storage R2 (Sprint 2) ─────────────────────────────
  STORAGE_DRIVER: Joi.string().valid('local', 'r2').optional(),
  R2_ACCOUNT_ID: requiredWhenR2('R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID: requiredWhenR2('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: requiredWhenR2('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET: requiredWhenR2('R2_BUCKET'),
  R2_PUBLIC_BUCKET: requiredWhenR2('R2_PUBLIC_BUCKET'),
  R2_PUBLIC_URL: Joi.string().uri().optional().allow(''),
  R2_ENDPOINT: Joi.string().uri().optional().allow(''),
});
