import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SocialInput {
  platform: 'instagram' | 'tiktok' | 'youtube';
  url: string;
  followers?: number;
}

export interface EnrichedSocial extends SocialInput {
  url: string;
  followers?: number;
  stats?: Record<string, unknown>;
}

/**
 * Normaliza/valida URLs de redes sociales y enriquece con datos públicos.
 * Fase 0: YouTube vía Data API v3 (gratis); IG/TikTok usan followers
 * auto-reportados por el usuario. Si una URL es inválida → se omite.
 */
@Injectable()
export class SocialMetadataService {
  private readonly logger = new Logger(SocialMetadataService.name);
  private readonly youtubeApiKey: string;

  constructor(config: ConfigService) {
    this.youtubeApiKey = config.get<string>('YOUTUBE_API_KEY') ?? '';
  }

  /** Normaliza una URL de red social; devuelve null si es inválida. */
  normalizeUrl(platform: string, url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;
    let parsed: URL;
    try {
      parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
      return null;
    }
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    switch (platform) {
      case 'instagram':
        return /instagram\.com$/.test(host) ? `https://${host}${parsed.pathname}` : null;
      case 'tiktok':
        return /tiktok\.com$/.test(host) ? `https://${host}${parsed.pathname}` : null;
      case 'youtube':
        return /(youtube\.com|youtu\.be)$/.test(host)
          ? `https://${host}${parsed.pathname}${parsed.search}`
          : null;
      default:
        return null;
    }
  }

  private extractYouTubeHandle(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/@|youtu\.be\/@|youtube\.com\/c\/|youtube\.com\/channel\/)([^/?#]+)/);
    return m ? m[1] : null;
  }

  /** Consulta YouTube Data API v3 para stats del canal (si hay key y handle). */
  async enrichYouTube(social: SocialInput): Promise<EnrichedSocial> {
    const base: EnrichedSocial = { ...social };
    if (social.platform !== 'youtube' || !this.youtubeApiKey) return base;
    const handle = this.extractYouTubeHandle(social.url);
    if (!handle) return base;
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/channels');
      url.searchParams.set('part', 'snippet,statistics');
      url.searchParams.set('forHandle', handle);
      url.searchParams.set('key', this.youtubeApiKey);
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        this.logger.warn(`YouTube API ${res.status} para @${handle}`);
        return base;
      }
      const data = (await res.json()) as {
        items?: { statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string } }[];
      };
      const item = data.items?.[0];
      if (!item?.statistics) return base;
      base.stats = {
        subscriberCount: item.statistics.subscriberCount,
        viewCount: item.statistics.viewCount,
        videoCount: item.statistics.videoCount,
      };
      const subs = Number(item.statistics.subscriberCount ?? NaN);
      if (!Number.isNaN(subs) && base.followers === undefined) {
        base.followers = subs;
      }
    } catch (e) {
      this.logger.warn(
        `YouTube enrich falló: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return base;
  }

  /**
   * Procesa la lista de redes: normaliza, omite inválidas y enriquece.
   * Devuelve las plataformas válidas.
   */
  async process(socials: SocialInput[]): Promise<EnrichedSocial[]> {
    const out: EnrichedSocial[] = [];
    for (const s of socials) {
      const normalized = this.normalizeUrl(s.platform, s.url);
      if (!normalized) {
        this.logger.warn(`Red social inválida omitida: ${s.platform} ${s.url}`);
        continue;
      }
      const enriched = await this.enrichYouTube({
        ...s,
        url: normalized,
      });
      out.push(enriched);
    }
    return out;
  }
}
