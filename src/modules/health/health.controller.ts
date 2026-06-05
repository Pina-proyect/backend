import { Controller, Get } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async getHealth() {
    const checks: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      await this.cache.get('health:ping');
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const allOk = Object.values(checks).every((s) => s === 'ok');

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || 'unknown',
      checks,
    };
  }
}
