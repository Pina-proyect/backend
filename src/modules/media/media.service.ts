import {
  Injectable,
  InternalServerErrorException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { StorageProvider } from '../storage/storage.provider';
import { PrismaService } from 'prisma/prisma.service';

/** Límite de tamaño por tipo (en bytes). Videos: 100MB; imágenes: 10MB. */
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Mime types permitidos por tipo. */
export const VIDEO_MIMES = ['video/mp4', 'video/webm'];
export const IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@Injectable()
export class MediaService {
  constructor(
    private readonly storage: StorageProvider,
    private readonly prisma: PrismaService,
  ) {}

  async saveMedia(
    creatorId: string,
    file: Express.Multer.File,
    title?: string,
  ) {
    try {
      const sanitizedName = file.originalname.replace(/\s+/g, '-');
      const filename = `${Date.now()}-${sanitizedName}`;

      // Determinar tipo y validar
      const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const allowed = type === 'video' ? VIDEO_MIMES : IMAGE_MIMES;
      if (!allowed.includes(file.mimetype)) {
        throw new InternalServerErrorException(
          type === 'video'
            ? 'Formato de video no permitido. Usá MP4 o WebM.'
            : 'Formato de imagen no permitido. Usá JPG, PNG, WebP o GIF.',
        );
      }
      const maxBytes = type === 'video' ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
      if (file.size > maxBytes) {
        throw new PayloadTooLargeException(
          type === 'video'
            ? 'El video supera el límite de 100MB.'
            : 'La imagen supera el límite de 10MB.',
        );
      }

      // 1. Subir al almacenamiento (type determina bucket privado/público)
      const url = await this.storage.upload(file.buffer, {
        filename,
        mimetype: file.mimetype,
        type,
      });

      // 2. Guardar en DB
      return await this.prisma.media.create({
        data: {
          creatorId,
          title: title || file.originalname,
          url,
          type,
          mimetype: file.mimetype,
          size: file.size,
        },
      });
    } catch (error) {
      console.error('Error saving media:', error);
      if (
        error instanceof PayloadTooLargeException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al procesar el archivo multimedia',
      );
    }
  }

  async getMediaByCreator(creatorId: string) {
    return this.prisma.media.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteMedia(creatorId: string, mediaId: string) {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, creatorId },
    });

    if (!media) {
      throw new InternalServerErrorException(
        'Medio no encontrado o no pertenece al usuario',
      );
    }

    // 1. Borrar de la base de datos
    await this.prisma.media.delete({ where: { id: mediaId } });

    // 2. Borrar del almacenamiento (vía el provider)
    await this.storage.delete(media.url);

    return { message: 'Medio eliminado con éxito' };
  }
}
