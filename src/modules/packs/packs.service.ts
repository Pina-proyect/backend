import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class PacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createPack(creatorId: string, data: {
    title: string;
    description?: string;
    price: number;
    categoryId: string;
    mediaIds: string[];
  }) {
    // Verificar que todos los medios pertenecen al creador
    const mediaCount = await this.prisma.media.count({
      where: {
        id: { in: data.mediaIds },
        creatorId,
      },
    });

    if (mediaCount !== data.mediaIds.length) {
      throw new ForbiddenException('Algunos archivos no pertenecen a tu cuenta o no existen');
    }

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
      where: { creatorId },
      include: {
        media: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
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
          }
        }
      },
    });

    if (!pack) throw new NotFoundException('Pack no encontrado');
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
      }
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
}
