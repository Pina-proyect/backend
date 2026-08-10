import { Injectable } from '@nestjs/common';
import { StorageProvider, ResolvedUrl } from '../storage/storage.provider';
import type { Media } from '@prisma/client';

/**
 * Resuelve URLs de visualización de forma centralizada.
 * - video → presigned (TTL 30 min, inline) vía StorageProvider.getUrl
 * - image → URL pública persistente (ya guardada en Media.url)
 * Evita duplicar lógica de URLs en cada controller.
 */
@Injectable()
export class MediaUrlResolver {
  constructor(private readonly storage: StorageProvider) {}

  /** Resuelve una URL de visualización para un media (video → firmada). */
  async resolve(media: Media): Promise<ResolvedUrl> {
    if (media.type === 'video') {
      // Media.url es el object key (media/<uuid>.<ext>) con R2; con local
      // es /uploads/<file> y getUrl devuelve la URL directa.
      return this.storage.getUrl(media.url);
    }
    return { url: media.url };
  }

  /** Resuelve una lista de media (para my-content, contenido de packs). */
  async resolveMany(
    media: Media[],
  ): Promise<Array<Media & { resolvedUrl: ResolvedUrl }>> {
    const out: Array<Media & { resolvedUrl: ResolvedUrl }> = [];
    for (const m of media) {
      out.push({ ...m, resolvedUrl: await this.resolve(m) });
    }
    return out;
  }

  /** Versión pública: blanquea videos (no expone URL real si isPrivate). */
  toPublic(media: Media): Media {
    if (media.type === 'video' && media.isPrivate) {
      return { ...media, url: '' };
    }
    return media;
  }

  /** Versión pública para listas. */
  toPublicMany(media: Media[]): Media[] {
    return media.map((m) => this.toPublic(m));
  }
}
