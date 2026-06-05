import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis | null;
  private readonly fallback = new Map<string, { value: string; expires: number }>();

  constructor(configService: ConfigService) {
    const url = configService.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL no configurada, usando fallback en memoria');
      this.client = null;
      return;
    }
    try {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: () => null,
      });
    } catch {
      this.logger.warn('Redis no disponible, usando fallback en memoria');
      this.client = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.client) {
      try {
        const raw = await this.client.get(key);
        return raw ? JSON.parse(raw) as T : null;
      } catch {
        return null;
      }
    }
    const entry = this.fallback.get(key);
    if (!entry || entry.expires < Date.now()) {
      this.fallback.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.client) {
      try {
        await this.client.setex(key, ttlSeconds, serialized);
      } catch {
        this.fallback.set(key, { value: serialized, expires: Date.now() + ttlSeconds * 1000 });
      }
    } else {
      this.fallback.set(key, { value: serialized, expires: Date.now() + ttlSeconds * 1000 });
    }
  }
}
