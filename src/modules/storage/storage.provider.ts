import { Injectable } from '@nestjs/common';

export interface StorageOptions {
  filename: string;
  mimetype: string;
}

@Injectable()
export abstract class StorageProvider {
  /**
   * Sube un archivo al almacenamiento.
   * Retorna la URL relativa o PATH del archivo.
   */
  abstract upload(file: Buffer, options: StorageOptions): Promise<string>;

  /**
   * Borra un archivo del almacenamiento.
   */
  abstract delete(url: string): Promise<void>;

  /**
   * Genera una URL de visualización (Para local será directa, para Cloud será Signed).
   */
  abstract getUrl(key: string): Promise<string>;
}
