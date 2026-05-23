import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageProvider } from '../storage/storage.provider';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class MediaService {
  constructor(
    private readonly storage: StorageProvider,
    private readonly prisma: PrismaService,
  ) {}

  async saveMedia(creatorId: string, file: Express.Multer.File, title?: string) {
    try {
      const sanitizedName = file.originalname.replace(/\s+/g, '-');
      const filename = `${Date.now()}-${sanitizedName}`;
      
      // 1. Subir al almacenamiento
      const url = await this.storage.upload(file.buffer, {
        filename,
        mimetype: file.mimetype,
      });

      // 2. Determinar tipo
      const type = file.mimetype.startsWith('video/') ? 'video' : 'image';

      // 3. Guardar en DB
      return await this.prisma.media.create({
        data: {
          creatorId,
          title: title || file.originalname,
          url,
          type,
          mimetype: file.mimetype,
          size: file.size,
        }
      });
    } catch (error) {
      console.error('Error saving media:', error);
      throw new InternalServerErrorException('Error al procesar el archivo multimedia');
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
      throw new InternalServerErrorException('Medio no encontrado o no pertenece al usuario');
    }

    // 1. Borrar de la base de datos
    await this.prisma.media.delete({ where: { id: mediaId } });

    // 2. Borrar del almacenamiento (vía el provider)
    await this.storage.delete(media.url);

    return { message: 'Medio eliminado con éxito' };
  }
}
