import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageOptions, StorageProvider } from './storage.provider';
import * as fs from 'fs-extra';
import { join } from 'path';

@Injectable()
export class LocalStorageService extends StorageProvider {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  constructor() {
    super();
    // Asegurar que el directorio existe
    fs.ensureDirSync(this.uploadDir);
  }

  async upload(file: Buffer, options: StorageOptions): Promise<string> {
    try {
      const filePath = join(this.uploadDir, options.filename);
      await fs.writeFile(filePath, file);
      // Retornamos la URL relativa que será servida por el backend
      return `/uploads/${options.filename}`;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al guardar archivo localmente',
      );
    }
  }

  async delete(url: string): Promise<void> {
    try {
      // Extraer el nombre del archivo de la URL (/uploads/filename)
      const filename = url.replace('/uploads/', '');
      const filePath = join(this.uploadDir, filename);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
    } catch (error) {
      // No lanzamos error si el archivo no existe, solo ignoramos
    }
  }

  async getUrl(key: string): Promise<string> {
    // En local, la URL es directa si el servidor expone la carpeta /uploads
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return `${backendUrl}${key}`;
  }
}
