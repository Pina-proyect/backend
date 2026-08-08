import type { Request } from 'express';
import type { Creator } from '@prisma/client';

/**
 * Request HTTP autenticado con el JWT de la app.
 * `req.user` es inyectado por el JwtStrategy (una instancia de Creator).
 */
export interface AuthenticatedRequest extends Request {
  user: Creator;
}
