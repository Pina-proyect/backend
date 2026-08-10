import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import {
  SocialMetadataService,
  EnrichedSocial,
} from './social-metadata.service';
import {
  AiAnalysisResultSchema,
  AiAnalysisResult,
} from '../schemas/ai-analysis.schema';
import { AnalyzeProfileDto } from '../dto/analyze-profile.dto';

export type AiCase = 'A' | 'B' | 'C' | 'D';

export interface AnalyzeOutcome {
  case: AiCase;
  suggestions?: AiAnalysisResult;
  reasons: string[];
  degraded: boolean;
  /** Metadata del provider que generó el resultado (solo caso A). */
  provider?: 'groq' | 'deepseek';
  model?: string;
  tokenUsage?: { input: number; output: number; total: number };
}

/**
 * Router adaptativo de análisis de perfil (casos A/B/C/D).
 * A: max(followers) >= umbral → plan directo.
 * B: < umbral → iterar ideas (no genera plan final aquí).
 * C: sin redes → el frontend usa el flujo de ideas (este servicio no llama LLM).
 * D: sin keys / sin consentimiento / fallo → modo manual ($0), nunca bloquea.
 */
@Injectable()
export class ProfileAnalyzerService {
  private readonly logger = new Logger(ProfileAnalyzerService.name);
  private readonly threshold: number;

  constructor(
    private readonly provider: AiProviderService,
    private readonly socials: SocialMetadataService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.threshold = config.get<number>('AI_FOLLOWER_THRESHOLD') ?? 1000;
  }

  private maxFollowers(socials: EnrichedSocial[]): number {
    return socials.reduce((max, s) => Math.max(max, s.followers ?? 0), 0);
  }

  async analyze(
    userId: string,
    dto: AnalyzeProfileDto,
  ): Promise<AnalyzeOutcome> {
    if (!dto.consent) {
      return {
        case: 'D',
        reasons: ['Consentimiento no otorgado'],
        degraded: true,
      };
    }

    // Normalizar y enriquecer redes; omite inválidas.
    const socials = await this.socials.process(
      (dto.socialLinks ?? []).map((s) => ({
        platform: s.platform,
        url: s.url,
        followers: s.followers,
      })),
    );

    // Caso C: sin redes válidas → flujo de ideas (frontend), sin LLM.
    if (socials.length === 0) {
      return {
        case: 'C',
        reasons: ['Sin redes sociales válidas'],
        degraded: true,
      };
    }

    const max = this.maxFollowers(socials);

    // Caso B: debajo del umbral → iterar ideas, no plan directo.
    if (max < this.threshold) {
      return {
        case: 'B',
        reasons: [
          `Máximo de followers (${max}) menor al umbral (${this.threshold})`,
        ],
        degraded: true,
      };
    }

    // Caso A: >= umbral → intentar plan directo; si falla el LLM → D.
    try {
      const payload = {
        niche: dto.niche,
        bio: dto.bio,
        country: dto.country,
        language: dto.language ?? 'es',
        socials: socials.map((s) => ({
          platform: s.platform,
          url: s.url,
          followers: s.followers,
        })),
      };
      const raw = await this.provider.analyze(payload);
      let lastRaw = raw;

      // Validación zod (anti-alucinación) con 1 retry.
      let parsed: AiAnalysisResult | null = null;
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        try {
          parsed = AiAnalysisResultSchema.parse(JSON.parse(lastRaw.content));
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          this.logger.warn(
            `JSON inválido del provider (intento ${attempt + 1}): ${lastError.message}`,
          );
          if (attempt === 0) {
            // 1 retry: re-llamar al provider (el servicio ya hace fallback).
            try {
              const retry = await this.provider.analyze(payload);
              lastRaw = retry;
              parsed = AiAnalysisResultSchema.parse(JSON.parse(retry.content));
            } catch (e2) {
              lastError = e2 instanceof Error ? e2 : new Error(String(e2));
            }
          }
        }
      }
      if (!parsed) {
        throw lastError ?? new Error('Resultado de IA inválido');
      }

      return {
        case: 'A',
        suggestions: parsed,
        reasons: [
          `Máximo de followers (${max}) alcanza el umbral (${this.threshold})`,
        ],
        degraded: false,
        provider: lastRaw.provider,
        model: lastRaw.model,
        tokenUsage: lastRaw.usage ?? { input: 0, output: 0, total: 0 },
      };
    } catch (e) {
      this.logger.warn(
        `Análisis IA falló, degradando a caso D: ${e instanceof Error ? e.message : String(e)}`,
      );
      return {
        case: 'D',
        reasons: ['El análisis con IA no está disponible'],
        degraded: true,
      };
    }
  }
}
