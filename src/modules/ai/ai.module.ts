import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiProviderService } from './services/ai-provider.service';
import { ProfileAnalyzerService } from './services/profile-analyzer.service';
import { SocialMetadataService } from './services/social-metadata.service';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { GroqProvider } from './providers/groq.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { CacheModule } from '../../common/cache/cache.module';
import { PrismaService } from '../../../prisma/prisma.service';

@Module({
  imports: [CacheModule],
  controllers: [AiController],
  providers: [
    GroqProvider,
    DeepSeekProvider,
    AiProviderService,
    ProfileAnalyzerService,
    SocialMetadataService,
    AiRateLimitGuard,
    PrismaService,
  ],
  exports: [AiProviderService, ProfileAnalyzerService],
})
export class AiModule {}
