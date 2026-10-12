import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

/**
 * Autenticación de administración para los endpoints de retiros (v1.27, D5).
 *
 * Lee `Authorization: Bearer <token>` y lo compara con `WITHDRAWALS_ADMIN_TOKEN`
 * usando `crypto.timingSafeEqual`. Fail-closed: si la variable está vacía,
 * siempre responde 401. Nunca loguea el token.
 */
@Injectable()
export class WithdrawalsAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('WITHDRAWALS_ADMIN_TOKEN') ?? '';
    if (!expected) {
      throw new UnauthorizedException('No autorizado');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(request.headers.authorization);

    // timingSafeEqual lanza si las longitudes difieren: se chequea antes.
    if (!token || token.length !== expected.length) {
      throw new UnauthorizedException('No autorizado');
    }

    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      throw new UnauthorizedException('No autorizado');
    }

    return true;
  }

  private extractBearer(header?: string): string | undefined {
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
    return value.trim();
  }
}
