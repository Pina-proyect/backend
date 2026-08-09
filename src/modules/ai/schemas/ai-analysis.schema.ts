import { z } from 'zod';

/**
 * Schema de salida del análisis de perfil (anti-alucinación).
 * Los providers generan JSON; este schema lo valida en servidor.
 * Si no valida → 1 retry → fallback a caso D (sugerencias vacías).
 */
export const AiAnalysisResultSchema = z.object({
  case: z.literal('A').or(z.literal('B')),
  suggestedNiche: z.string().min(1).max(60),
  suggestedBio: z.string().min(1).max(255),
  suggestedGoal: z.object({
    title: z.string().max(100),
    amount: z.number().positive(),
    currency: z.string().default('ARS'),
  }),
  suggestedPlan: z.array(z.string().max(200)).min(1).max(8),
  language: z.string().default('es'),
});

export type AiAnalysisResult = z.infer<typeof AiAnalysisResultSchema>;
