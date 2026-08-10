import { Injectable } from '@nestjs/common';

export type StorageType = 'video' | 'image';

export interface StorageOptions {
  filename: string;
  mimetype: string;
  /** Tipo de medio: determina bucket privado (video) vs público (image). */
  type: StorageType;
}

/** URL resuelta para visualización. `expiresAt` solo aplica a URLs firmadas. */
export interface ResolvedUrl {
  url: string;
  expiresAt?: string;
}

@Injectable()
export abstract class StorageProvider {
  /**
   * Sube un archivo al almacenamiento.
   * Retorna el object key (video → `media/<uuid>.<ext>`) o la URL pública (image).
   */
  abstract upload(file: Buffer, options: StorageOptions): Promise<string>;

  /**
   * Borra un archivo del almacenamiento. Idempotente.
   */
  abstract delete(urlOrKey: string): Promise<void>;

  /**
   * Genera una URL de visualización.
   * Local: URL directa. Cloud (R2): URL presignada con expiración.
   */
  abstract getUrl(key: string, ttlSeconds?: number): Promise<ResolvedUrl>;
}
