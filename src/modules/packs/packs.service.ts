import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { UpdatePackDto } from './dto/update-pack.dto';
import { MediaVisibility } from './dto/media-visibility';

@Injectable()
export class PacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Aplica la visibilidad por media (`preview`/`exclusive`) a las filas `Media`,
   * validando primero que cada media pertenezca al creador (REQ-SVD-3, D3).
   * Aditivo: sin `mediaVisibility` no toca ninguna fila.
   */
  private async applyMediaVisibility(
    creatorId: string,
    mediaVisibility?: Record<string, MediaVisibility>,
  ): Promise<void> {
    if (!mediaVisibility) return;
    const mediaIds = Object.keys(mediaVisibility);
    if (mediaIds.length === 0) return;

    const mediaCount = await this.prisma.media.count({
      where: { id: { in: mediaIds }, creatorId },
    });
    if (mediaCount !== mediaIds.length) {
      throw new ForbiddenException(
        'Algunos archivos no pertenecen a tu cuenta o no existen',
      );
    }

    await Promise.all(
      mediaIds.map((id) =>
        this.prisma.media.update({
          where: { id },
          data: { visibility: mediaVisibility[id] },
        }),
      ),
    );
  }

  async createPack(
    creatorId: string,
    data: {
      title: string;
      description?: string;
      price: number;
      categoryId: string;
      mediaIds: string[];
      mediaVisibility?: Record<string, MediaVisibility>;
    },
  ) {
    // Verificar que todos los medios pertenecen al creador
    const mediaCount = await this.prisma.media.count({
      where: {
        id: { in: data.mediaIds },
        creatorId,
      },
    });

    if (mediaCount !== data.mediaIds.length) {
      throw new ForbiddenException(
        'Algunos archivos no pertenecen a tu cuenta o no existen',
      );
    }

    // Persistir visibilidad antes del create para que el include la refleje.
    await this.applyMediaVisibility(creatorId, data.mediaVisibility);

    return this.prisma.contentPack.create({
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        creatorId,
        categoryId: data.categoryId,
        media: {
          connect: data.mediaIds.map((id) => ({ id })),
        },
      },
      include: {
        media: true,
        category: true,
      },
    });
  }

  async getMyPacks(creatorId: string) {
    return this.prisma.contentPack.findMany({
      where: { creatorId, status: { not: 'archived' } },
      include: {
        media: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca un pack sin filtrar por `status` (incluye archivados).
   * Lo usan las mutaciones (PATCH/DELETE) para poder distinguir "no existe"
   * (404) de "archivado" (idempotencia de DELETE).
   */
  private findPackRaw(packId: string) {
    return this.prisma.contentPack.findUnique({
      where: { id: packId },
      select: { id: true, creatorId: true, status: true },
    });
  }

  async updatePack(creatorId: string, packId: string, dto: UpdatePackDto) {
    // Regla de negocio: al menos un campo presente (DTO todo-opcional).
    const hasField = Object.values(dto).some((value) => value !== undefined);
    if (!hasField) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar el pack',
      );
    }

    const pack = await this.findPackRaw(packId);
    if (!pack) throw new NotFoundException('Pack no encontrado');
    // 404 antes que 403: no se filtra la existencia de packs archivados ajenos.
    if (pack.status === 'archived')
      throw new NotFoundException('Pack no encontrado');
    if (pack.creatorId !== creatorId)
      throw new ForbiddenException('No puedes editar este pack');

    const data: Prisma.ContentPackUpdateInput = {
      title: dto.title,
      description: dto.description,
      price: dto.price,
      status: dto.status,
    };

    if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.mediaIds !== undefined) {
      const mediaCount = await this.prisma.media.count({
        where: { id: { in: dto.mediaIds }, creatorId },
      });
      if (mediaCount !== dto.mediaIds.length) {
        throw new ForbiddenException(
          'Algunos archivos no pertenecen a tu cuenta o no existen',
        );
      }
      data.media = { set: dto.mediaIds.map((id) => ({ id })) };
    }

    // Persistir visibilidad antes del update para que el include la refleje.
    await this.applyMediaVisibility(creatorId, dto.mediaVisibility);

    return this.prisma.contentPack.update({
      where: { id: packId },
      data,
      include: {
        media: true,
        category: true,
      },
    });
  }

  /**
   * Soft-delete: marca el pack como `archived` sin borrar filas ni medios.
   * Idempotente: archivar un pack ya archivado del mismo dueño no falla.
   */
  async deletePack(creatorId: string, packId: string): Promise<void> {
    const pack = await this.findPackRaw(packId);
    if (!pack) throw new NotFoundException('Pack no encontrado');
    if (pack.creatorId !== creatorId)
      throw new ForbiddenException('No puedes eliminar este pack');

    await this.prisma.contentPack.update({
      where: { id: packId },
      data: { status: 'archived' },
    });
  }

  async getPackById(packId: string) {
    const pack = await this.prisma.contentPack.findUnique({
      where: { id: packId },
      include: {
        media: true,
        category: true,
        creator: {
          select: {
            fullName: true,
            slug: true,
          },
        },
      },
    });

    if (!pack) throw new NotFoundException('Pack no encontrado');
    if (pack.status === 'archived')
      throw new NotFoundException('Pack no encontrado');
    return pack;
  }

  async getPacksByCategory(categoryName: string) {
    return this.prisma.contentPack.findMany({
      where: {
        category: { name: categoryName },
        status: 'active',
      },
      include: {
        media: true,
        category: true,
      },
    });
  }

  async getAllCategories() {
    const cacheKey = 'categories';
    const cached = await this.cache.get<object[]>(cacheKey);
    if (cached) return cached;
    const categories = await this.prisma.category.findMany();
    await this.cache.set(cacheKey, categories, 900);
    return categories;
  }

  async getPacksByCreatorSlug(slug: string) {
    return this.prisma.contentPack.findMany({
      where: {
        creator: { slug },
        status: 'active',
      },
      include: {
        media: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Lógica de acceso
  async hasAccess(userId: string, packId: string): Promise<boolean> {
    // Si el usuario es el dueño del pack, tiene acceso
    const pack = await this.prisma.contentPack.findUnique({
      where: { id: packId },
      select: { creatorId: true },
    });

    if (pack?.creatorId === userId) return true;

    // Verificar si existe un registro en la tabla de Access
    const access = await this.prisma.access.findUnique({
      where: {
        userId_packId: {
          userId,
          packId,
        },
      },
    });

    return !!access;
  }

  async grantAccess(userId: string, packId: string, type: string = 'purchase') {
    return this.prisma.access.create({
      data: {
        userId,
        packId,
        type,
      },
    });
  }

  async getComments(packId: string) {
    const pack = await this.prisma.contentPack.findUnique({
      where: { id: packId },
    });
    if (!pack) throw new NotFoundException('Pack no encontrado');

    return this.prisma.comment.findMany({
      where: { packId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, fullName: true, slug: true, photoPath: true },
        },
      },
    });
  }

  async createComment(packId: string, creatorId: string, content: string) {
    const pack = await this.prisma.contentPack.findUnique({
      where: { id: packId },
    });
    if (!pack) throw new NotFoundException('Pack no encontrado');

    return this.prisma.comment.create({
      data: { content, packId, creatorId },
      include: {
        creator: {
          select: { id: true, fullName: true, slug: true, photoPath: true },
        },
      },
    });
  }

  async updateComment(commentId: string, creatorId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (comment.creatorId !== creatorId)
      throw new ForbiddenException('No puedes editar este comentario');

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        creator: {
          select: { id: true, fullName: true, slug: true, photoPath: true },
        },
      },
    });
  }

  async deleteComment(commentId: string, creatorId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (comment.creatorId !== creatorId)
      throw new ForbiddenException('No puedes eliminar este comentario');

    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
