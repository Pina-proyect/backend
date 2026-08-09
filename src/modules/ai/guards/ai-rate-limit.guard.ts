import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../common/cache/cache.service';
import { AuthenticatedRequest } from '../../../common/types/authenticated-request';

/**
 * Límite por usuario: AI_DAILY_LIMIT (default 5) generaciones cada 24h.
 * Clave Redis: ai:analyze:{userId}, TTL 86400. Al exceder → 429 (español).
 */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly dailyLimit: number;

  constructor(
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.dailyLimit = config.get<number>('AI_DAILY_LIMIT') ?? 5;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId: string | undefined = req.user?.id;
    if (!userId) {
      // Sin usuario autenticado → bloqueado por el guard JWT antes.
      return true;
    }
    const key = `ai:analyze:${userId}`;
    const current = (await this.cache.get<number>(key)) ?? 0;
    if (current >= this.dailyLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Llegaste al límite de generaciones de IA de hoy. Volvé mañana o seguí con el flujo manual.',
          code: 'AI_DAILY_LIMIT_REACHED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.cache.set(key, current + 1, 86400);
    return true;
  }
}
