import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  IAiProvider,
  AiAnalysisPayload,
  AiRawResult,
  ChatMessage,
  ChatOpts,
} from './ia-provider.interface';

/**
 * Provider primario: Groq (llama-3.1-8b-instant).
 * Usa response_format.json_schema con strict:true para JSON garantizado.
 */
@Injectable()
export class GroqProvider implements IAiProvider {
  readonly name = 'groq' as const;
  private readonly logger = new Logger(GroqProvider.name);
  private readonly client: Groq | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('GROQ_API_KEY');
    if (apiKey) {
      this.client = new Groq({ apiKey });
    } else {
      this.client = null;
      this.logger.warn(
        'GROQ_API_KEY no configurada — GroqProvider desactivado',
      );
    }
    this.model = config.get<string>('GROQ_MODEL') ?? 'llama-3.1-8b-instant';
  }

  get available(): boolean {
    return this.client !== null;
  }

  async analyze(payload: AiAnalysisPayload): Promise<AiRawResult> {
    if (!this.client) throw new Error('GroqProvider sin API key');
    const system = buildSystemPrompt();
    const user = buildUserPrompt(payload);
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ai_analysis_result',
          strict: true,
          schema: aiAnalysisJsonSchema(),
        },
      },
    });
    const content = completion.choices[0]?.message?.content ?? '';
    return {
      content,
      provider: this.name,
      model: this.model,
      usage: completion.usage
        ? {
            input: completion.usage.prompt_tokens ?? 0,
            output: completion.usage.completion_tokens ?? 0,
            total:
              (completion.usage.prompt_tokens ?? 0) +
              (completion.usage.completion_tokens ?? 0),
          }
        : undefined,
    };
  }

  async chat(messages: ChatMessage[], opts: ChatOpts): Promise<AiRawResult> {
    if (!this.client) throw new Error('GroqProvider sin API key');
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 400,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    return {
      content: completion.choices[0]?.message?.content ?? '',
      provider: this.name,
      model: this.model,
    };
  }
}

/** Construye el prompt de sistema para análisis de perfil. */
export function buildSystemPrompt(): string {
  return [
    'Sos un asesor de marca para creadoras de contenido en Pina (plataforma de micro-influencers).',
    'Recibís metadatos estructurados de redes sociales y generás un plan de marca.',
    'Respondé SIEMPRE en el idioma pedido (default español).',
    'Sé concreto, accionable y realista. Nunca inventes números de audiencia.',
    'El resultado debe ser un JSON válido que cumpla estrictamente el schema indicado.',
  ].join('\n');
}

/** Construye el prompt de usuario con los metadatos estructurados. */
export function buildUserPrompt(payload: AiAnalysisPayload): string {
  return JSON.stringify({
    instruction:
      'Generá un plan de marca para esta creadora usando solo estos datos estructurados:',
    language: payload.language,
    niche: payload.niche ?? null,
    bio: payload.bio ?? null,
    country: payload.country ?? null,
    socials: payload.socials,
  });
}

/**
 * JSON Schema fijo para Groq json_schema strict, equivalente al contrato
 * AiAnalysisResultSchema (validado en el service con zod).
 */
export function aiAnalysisJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      case: { type: 'string', enum: ['A', 'B'] },
      suggestedNiche: { type: 'string', minLength: 1, maxLength: 60 },
      suggestedBio: { type: 'string', minLength: 1, maxLength: 255 },
      suggestedGoal: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', maxLength: 100 },
          amount: { type: 'number', exclusiveMinimum: 0 },
          currency: { type: 'string' },
        },
        required: ['title', 'amount', 'currency'],
      },
      suggestedPlan: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: { type: 'string', maxLength: 200 },
      },
      language: { type: 'string' },
    },
    required: [
      'case',
      'suggestedNiche',
      'suggestedBio',
      'suggestedGoal',
      'suggestedPlan',
      'language',
    ],
  };
}
