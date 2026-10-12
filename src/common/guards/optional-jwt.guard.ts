import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard de JWT OPCIONAL.
 *
 * Extiende `AuthGuard('jwt')` y sobreescribe `handleRequest` para NO lanzar
 * `UnauthorizedException`: si el token es válido resuelve el usuario; si falta,
 * es inválido o está expirado, resuelve `null` y el request se trata como
 * anónimo (el controlador decide qué hacer sin `hasAccess`).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser | null {
    // Se ignora `err` a propósito: el objetivo es autenticación opcional.
    // `user` llega como `false`/`undefined` cuando no hay token válido, por lo
    // que se normaliza cualquier valor falsy a `null` (sin lanzar 401).
    void err;
    return user || null;
  }
}
