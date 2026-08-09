import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IAiProvider,
  AiAnalysisPayload,
  AiRawResult,
  ChatMessage,
  ChatOpts,
} from '../providers/ia-provider.interface';
import { GroqProvider } from '../providers/groq.provider';
import { DeepSeekProvider } from '../providers/deepseek.provider';

/**
 * Orquesta los providers con fallback en cadena (Groq → DeepSeek) y
 * circuit breaker: N fallos consecutivos → abierto 30s → half-open 1 probe.
 * Si todos fallan, lanza error → el router degrada a caso D.
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly failureThreshold: number;
  private readonly resetMs: number;
  private consecutiveFailures = 0;
  private openUntil = 0;
  private readonly timeoutMs: Record<'groq' | 'deepseek', number> = {
    groq: 8000,
    deepseek: 10000,
  };

  constructor(
    private readonly groq: GroqProvider,
    private readonly deepseek: DeepSeekProvider,
    config: ConfigService,
  ) {
    this.failureThreshold = config.get<number>('AI_CB_FAILURE_THRESHOLD') ?? 3;
    this.resetMs = config.get<number>('AI_CB_RESET_MS') ?? 30000;
  }

  private get providers(): IAiProvider[] {
    return [this.groq, this.deepseek].filter((p) => p.available);
  }

  private isOpen(): boolean {
    if (this.consecutiveFailures < this.failureThreshold) return false;
    if (Date.now() > this.openUntil) {
      // half-open: permitir 1 probe
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openUntil = Date.now() + this.resetMs;
      this.logger.warn(
        `Circuit breaker abierto por ${this.resetMs}ms tras ${this.consecutiveFailures} fallos`,
      );
    }
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout tras ${ms}ms`)), ms),
      ),
    ]);
  }

  async analyze(
    payload: AiAnalysisPayload,
  ): Promise<AiRawResult> {
    const available = this.providers;
    if (available.length === 0) {
      throw new Error('Ningún provider de IA configurado');
    }
    if (this.isOpen()) {
      throw new Error('Circuit breaker abierto — IA no disponible');
    }

    let lastError: Error | null = null;
    for (const provider of available) {
      try {
        const result = await this.withTimeout(
          provider.analyze(payload),
          this.timeoutMs[provider.name],
        );
        this.recordSuccess();
        return result;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        this.logger.warn(
          `Provider ${provider.name} falló: ${lastError.message}`,
        );
        this.recordFailure();
      }
    }
    throw lastError ?? new Error('Todos los providers fallaron');
  }

  async chat(messages: ChatMessage[], opts: ChatOpts): Promise<AiRawResult> {
    const available = this.providers;
    if (available.length === 0) {
      throw new Error('Ningún provider de IA configurado');
    }
    if (this.isOpen()) {
      throw new Error('Circuit breaker abierto — IA no disponible');
    }

    let lastError: Error | null = null;
    for (const provider of available) {
      try {
        const result = await this.withTimeout(
          provider.chat(messages, opts),
          this.timeoutMs[provider.name],
        );
        this.recordSuccess();
        return result;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        this.logger.warn(
          `Provider ${provider.name} falló (chat): ${lastError.message}`,
        );
        this.recordFailure();
      }
    }
    throw lastError ?? new Error('Todos los providers fallaron (chat)');
  }
}
