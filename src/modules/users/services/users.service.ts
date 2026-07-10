import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreatorRepository } from '../../auth/repositories/creator.repository';
import { UpdateProfileDto } from '../../auth/dto/update-profile.dto';
import { PrismaService } from 'prisma/prisma.service';
import type { Creator } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Actualiza el perfil de un usuario
   * Valida que el slug sea único si se proporciona
   */
  async updateProfile(
    userId: string,
    updateData: UpdateProfileDto,
  ): Promise<Creator> {
    // Si se proporciona un slug, verificar que sea único
    if (updateData.slug) {
      const existingCreator = await this.creatorRepository.findBySlug(
        updateData.slug,
      );
      if (existingCreator && existingCreator.id !== userId) {
        throw new ConflictException('El slug ya está en uso por otro usuario');
      }
    }

    // Actualizar el perfil
    const updatedCreator = await this.creatorRepository.update(
      userId,
      updateData,
    );

    if (!updatedCreator) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return updatedCreator;
  }

  /**
   * Obtiene el perfil de un usuario por su ID
   */
  async getProfile(userId: string): Promise<Creator> {
    const creator = await this.creatorRepository.findById(userId);

    if (!creator) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return creator;
  }

  /**
   * Obtiene el perfil de un usuario por su slug (público)
   */
  async getProfileBySlug(slug: string): Promise<Creator | null> {
    const creator = await this.creatorRepository.findBySlug(slug);

    return creator;
  }

  /**
   * Busca creadores por nombre o slug y opcionalmente por nicho
   */
  async searchCreators(query?: string, niche?: string) {
    const creators = await this.creatorRepository.search(query, niche);
    // Filtramos datos sensibles
    return creators.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      slug: c.slug,
      photoPath: c.photoPath,
      niche: c.niche,
      bio: c.bio,
      gender: c.gender,
    }));
  }

  async getLibrary(userId: string) {
    const accessRecords = await this.prisma.access.findMany({
      where: { userId },
      include: {
        pack: {
          include: {
            media: true,
            category: true,
            creator: {
              select: { fullName: true, slug: true, photoPath: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return accessRecords.map((a) => a.pack);
  }

  async getSessions(userId: string) {
    return this.prisma.notification.findMany({
      where: { creatorId: userId, type: 'session' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getFeed(userId: string) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    if (followingIds.length === 0) return [];

    return this.prisma.contentPack.findMany({
      where: {
        creatorId: { in: followingIds },
        status: 'active',
      },
      include: {
        media: true,
        category: true,
        creator: {
          select: { fullName: true, slug: true, photoPath: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
