import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreatorRepository } from '../../auth/repositories/creator.repository';
import { UpdateProfileDto } from '../../auth/dto/update-profile.dto';
import type { Creator } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly creatorRepository: CreatorRepository) {}

  /**
   * Actualiza el perfil de un usuario
   * Valida que el slug sea único si se proporciona
   */
  async updateProfile(userId: string, updateData: UpdateProfileDto): Promise<Creator> {
    // Si se proporciona un slug, verificar que sea único
    if (updateData.slug) {
      const existingCreator = await this.creatorRepository.findBySlug(updateData.slug);
      if (existingCreator && existingCreator.id !== userId) {
        throw new ConflictException('El slug ya está en uso por otro usuario');
      }
    }

    // Actualizar el perfil
    const updatedCreator = await this.creatorRepository.update(userId, updateData);
    
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
}