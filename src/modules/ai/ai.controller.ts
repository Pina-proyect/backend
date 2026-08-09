import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { ProfileAnalyzerService } from './services/profile-analyzer.service';
import { AiProviderService } from './services/ai-provider.service';
import {
  AnalyzeProfileDto,
  OnboardingIdeasDto,
} from './dto/analyze-profile.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('ai')
@UseGuards(AuthGuard('jwt'))
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class AiController {
  constructor(
    private readonly analyzer: ProfileAnalyzerService,
    private readonly provider: AiProviderService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('profile/analyze')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRateLimitGuard)
  async analyze(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AnalyzeProfileDto,
  ) {
    const userId = req.user.id;
    const outcome = await this.analyzer.analyze(userId, dto);

    // Persistir el intento en CreatorInsight (historial).
    await this.prisma.creatorInsight.create({
      data: {
        creatorId: userId,
        type: 'onboarding',
        case: outcome.case,
        content: outcome.suggestions
          ? JSON.stringify(outcome.suggestions)
          : JSON.stringify({ reasons: outcome.reasons }),
        metadata: {
          case: outcome.case,
          provider: null,
          model: null,
          language: dto.language ?? 'es',
          tokenUsage: { input: 0, output: 0, total: 0 },
          inputSnapshot: {
            platforms: (dto.socialLinks ?? []).map((s) => ({
              platform: s.platform,
              url: s.url,
              followers: s.followers,
            })),
            country: dto.country,
            niche: dto.niche,
            bio: dto.bio,
          },
          accepted: false,
        },
      },
    });

    // Caso D sin LLM disponible por falta de keys → 503 con sugerencia de flujo manual.
    if (
      outcome.case === 'D' &&
      !outcome.reasons.includes('Consentimiento no otorgado')
    ) {
      const hasGroq = !!process.env.GROQ_API_KEY;
      const hasDeepseek = !!process.env.DEEPSEEK_API_KEY;
      if (!hasGroq && !hasDeepseek) {
        throw new ServiceUnavailableException({
          statusCode: 503,
          message:
            'El análisis con IA no está configurado. Podés continuar con el flujo manual.',
          code: 'AI_NOT_CONFIGURED',
          case: 'D',
        });
      }
    }

    return outcome;
  }

  @Post('onboarding/ideas')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRateLimitGuard)
  async ideas(
    @Req() req: AuthenticatedRequest,
    @Body() dto: OnboardingIdeasDto,
  ) {
    const userId = req.user.id;
    try {
      // 1 llamada stateless por paso, con contexto del insight anterior.
      const previous = await this.prisma.creatorInsight.findFirst({
        where: { creatorId: userId, type: 'idea-step' },
        orderBy: { createdAt: 'desc' },
      });
      const context = previous?.content ?? dto.baseContext ?? '';
      const messages = [
        {
          role: 'system' as const,
          content:
            'Sos un asesor de marca para creadoras de Pina. Guiás una entrevista corta para descubrir qué desea crear. Respondé en el idioma del usuario (default español). Sé concreto y con 1-3 preguntas o sugerencias accionables.',
        },
        {
          role: 'user' as const,
          content: `Contexto previo: ${context}\nPaso ${dto.stepIndex}. Respuestas del usuario: ${JSON.stringify(dto.answers ?? [])}`,
        },
      ];
      const result = await this.provider.chat(messages, { maxTokens: 400 });
      await this.prisma.creatorInsight.create({
        data: {
          creatorId: userId,
          type: 'idea-step',
          case: dto.case,
          content: result.content,
          metadata: {
            case: dto.case,
            provider: result.provider,
            model: result.model,
            language: 'es',
            tokenUsage: result.usage ?? { input: 0, output: 0, total: 0 },
            inputSnapshot: {
              stepIndex: dto.stepIndex,
              answers: dto.answers ?? [],
            },
            accepted: false,
          },
        },
      });
      return { stepIndex: dto.stepIndex, content: result.content };
    } catch {
      return {
        degraded: true,
        message:
          'El asistente de ideas no está disponible. Podés continuar eligiendo tus preferencias manualmente.',
      };
    }
  }

  @Get('insights')
  @HttpCode(HttpStatus.OK)
  async insights(@Req() req: AuthenticatedRequest) {
    const rows = await this.prisma.creatorInsight.findMany({
      where: { creatorId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows;
  }
}
