import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from 'prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

@Module({
  controllers: [HealthController],
  providers: [PrismaService, CacheService],
})
export class HealthModule {}
