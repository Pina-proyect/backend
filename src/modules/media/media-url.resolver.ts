import { Injectable } from '@nestjs/common';
import { StorageProvider } from '../storage/storage.provider';
import type { Media } from '@prisma/client';

/** Item de media con su URL resuelta en el nivel superior (REQ-SVD-5). */
export type ResolvedMedia = Media & { expiresAt?: string };

/** Estructura mínima con `media` que consumen las proyecciones de packs. */
type HasMedia = { media: Media[] };

/**
 * Resuelve URLs de visualización de forma centralizada (REQ-SVD-3/5).
 * - video → URL presignada de corta vida (+ `expiresAt`), fusionada en `url`.
 * - image → URL pública persistente.
 * Emite `url`/`expiresAt` en el nivel superior del item; nunca anida
 * `resolvedUrl` (el fallback legacy vive en el consumidor, REQ-SVD-6).
 */
@Injectable()
export class MediaUrlResolver {
  constructor(private readonly storage: StorageProvider) {}

  /**
   * `true` si la URL es un object key crudo (no pública ni servida por el
   * backend). Cierra la fuga de keys privadas aunque `isPrivate` sea false.
   */
  isNonPublic(url: string): boolean {
    return !/^(https?:\/\/|\/uploads\/)/.test(url);
  }

  /** Proyección firmada de un media: video → presignado, imagen → passthrough. */
  async resolveItem(media: Media): Promise<ResolvedMedia> {
    if (media.type === 'video') {
      const resolved = await this.storage.getUrl(media.url);
      const item: ResolvedMedia = { ...media, url: resolved.url };
      if (resolved.expiresAt !== undefined) {
        item.expiresAt = resolved.expiresAt;
      }
      return item;
    }
    return { ...media };
  }

  /** Proyección firmada de una lista (Promise.all — presign es firma local). */
  async resolveItems(media: Media[]): Promise<ResolvedMedia[]> {
    return Promise.all(media.map((m) => this.resolveItem(m)));
  }

  /**
   * Proyección pública de un media: los videos (y cualquier object key crudo,
   * por si `isPrivate` fuera false) se blanquean; las portadas de imagen
   * públicas pasan tal cual (REQ-SVD-3).
   */
  toPublicItem(media: Media): Media {
    if (media.type === 'video' || this.isNonPublic(media.url)) {
      return { ...media, url: '' };
    }
    return { ...media };
  }

  /** Proyección pública de una lista. */
  toPublicItems(media: Media[]): Media[] {
    return media.map((m) => this.toPublicItem(m));
  }

  /** Proyección firmada para listas de packs (packs.controller, users). */
  async resolvePacks<T extends HasMedia>(
    packs: T[],
  ): Promise<Array<T & { media: ResolvedMedia[] }>> {
    return Promise.all(
      packs.map(async (pack) => ({
        ...pack,
        media: await this.resolveItems(pack.media),
      })),
    );
  }

  /** Proyección pública para listas de packs. */
  toPublicPacks<T extends HasMedia>(packs: T[]): Array<T & { media: Media[] }> {
    return packs.map((pack) => ({
      ...pack,
      media: this.toPublicItems(pack.media),
    }));
  }
}
