/** Payload normalizado para el análisis de perfil (casos A/B). */
export interface AiAnalysisPayload {
  niche?: string;
  bio?: string;
  country?: string;
  language: string;
  socials: { platform: string; url: string; followers?: number }[];
}

/** Resultado crudo de un provider (antes de validación zod). */
export interface AiRawResult {
  content: string;
  usage?: { input: number; output: number; total: number };
  provider: 'groq' | 'deepseek';
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOpts {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Abstracción de provider LLM (compatibles con API OpenAI).
 * Implementaciones: GroqProvider (primary), DeepSeekProvider (fallback).
 * La validación del JSON de salida (anti-alucinación) se hace en el service
 * con zod; el provider solo pide JSON estructurado al modelo.
 */
export interface IAiProvider {
  readonly name: 'groq' | 'deepseek';
  /** Análisis estructurado con respuesta en JSON (el service valida con zod). */
  analyze(payload: AiAnalysisPayload): Promise<AiRawResult>;
  /** Chat para pasos de ideas (casos B/C). */
  chat(messages: ChatMessage[], opts: ChatOpts): Promise<AiRawResult>;
}
