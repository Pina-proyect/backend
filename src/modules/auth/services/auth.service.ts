import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import type { Creator } from '@prisma/client';

/**
 * AuthService
 * Responsable de validar o crear usuarios provenientes de proveedores OAuth (Google/Facebook).
 * Implementa la lógica de "buscar por proveedor" y, si no existe, asociar por email o crear.
 */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * validateOrCreateProviderUser
   * - Busca un Creator por provider + providerId.
   * - Si existe, lo devuelve.
   * - Si no existe, intenta vincular por email; si hay coincidencia, actualiza campos de proveedor.
   * - Caso contrario, crea un nuevo Creator mínimo para onboarding.
   *
   * Nota: birthDate no está disponible desde Google; se establece un placeholder.
   * Luego deberá completarse durante el onboarding.
   */
  async validateOrCreateProviderUser(params: {
    provider: 'google' | 'facebook' | 'credentials';
    providerId: string;
    email: string;
    fullName: string;
  }): Promise<Creator> {
    const { provider, providerId, email, fullName } = params;

    // 1) Buscar por provider + providerId (login repetido)
    const existingByProvider = await this.prisma.creator.findFirst({
      where: { provider, providerId },
    });
    if (existingByProvider) return existingByProvider;

    // 2) Intentar vincular por email (usuario local que agrega OAuth)
    const existingByEmail = await this.prisma.creator.findUnique({
      where: { email },
    });
    if (existingByEmail) {
      return this.prisma.creator.update({
        where: { id: existingByEmail.id },
        data: {
          provider,
          providerId,
          fullName, // actualiza nombre si cambió
        },
      });
    }

    // 3) Crear un nuevo usuario mínimo (onboarding posterior para completar datos)
    return this.prisma.creator.create({
      data: {
        fullName,
        email,
        // Placeholder: se completará durante onboarding
        birthDate: new Date('1970-01-01T00:00:00.000Z'),
        verificationStatus: 'pending',
        provider,
        providerId,
        // Campos opcionales (no provistos por OAuth)
        password: null,
        phone: null,
        selfiePath: null,
        photoPath: null,
      },
    });
  }
}