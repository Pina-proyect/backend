import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IAiProvider,
  AiAnalysisPayload,
  AiRawResult,
  ChatMessage,
  ChatOpts,
} from './ia-provider.interface';
import { buildSystemPrompt, buildUserPrompt } from './groq.provider';

/**
 * Provider fallback: DeepSeek (v4-flash). Compatible con API OpenAI,
 * usa baseURL https://api.deepseek.com y response_format json_object.
 */
@Injectable()
export class DeepSeekProvider implements IAiProvider {
  readonly name = 'deepseek' as const;
  private readonly logger = new Logger(DeepSeekProvider.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('DEEPSEEK_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com',
      });
    } else {
      this.client = null;
      this.logger.warn(
        'DEEPSEEK_API_KEY no configurada — DeepSeekProvider desactivado',
      );
    }
    this.model = config.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat';
  }

  get available(): boolean {
    return this.client !== null;
  }

  async analyze(payload: AiAnalysisPayload): Promise<AiRawResult> {
    if (!this.client) throw new Error('DeepSeekProvider sin API key');
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(payload) },
      ],
      response_format: { type: 'json_object' },
    });
    return {
      content: completion.choices[0]?.message?.content ?? '',
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
    if (!this.client) throw new Error('DeepSeekProvider sin API key');
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
