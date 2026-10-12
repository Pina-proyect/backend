import type { Request } from 'express';
import type { Creator } from '@prisma/client';

/**
 * Request HTTP autenticado con el JWT de la app.
 * `req.user` es inyectado por el JwtStrategy (una instancia de Creator).
 */
export interface AuthenticatedRequest extends Request {
  user: Creator;
}

/**
 * Request HTTP con autenticación OPCIONAL.
 * `req.user` es inyectado por el OptionalJwtAuthGuard solo cuando el token es
 * válido; en un request anónimo (sin token, inválido o expirado) queda `undefined`.
 */
export interface OptionalAuthenticatedRequest extends Request {
  user?: Creator;
}
