import { Injectable } from '@nestjs/common';
import { Creator, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CreatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Sobrecarga: admite Prisma input tradicional y Partial<Creator> para OAuth
  async create(data: Prisma.CreatorCreateInput): Promise<Creator>;
  async create(data: Partial<Creator>): Promise<Creator>;
  async create(data: Prisma.CreatorCreateInput | Partial<Creator>): Promise<Creator> {
    // Si el caller pasó Prisma.CreatorCreateInput, lo usamos directo.
    if ('verificationStatus' in data && 'birthDate' in data) {
      return this.prisma.creator.create({ data: data as Prisma.CreatorCreateInput });
    }

    // Caso Partial<Creator>: mapeamos a los campos aceptados por Prisma
    const mapped: Prisma.CreatorCreateInput = {
      fullName: (data as Partial<Creator>).fullName!,
      email: (data as Partial<Creator>).email!,
      birthDate: (data as Partial<Creator>).birthDate ?? new Date(),
      verificationStatus: 'pending',
      selfiePath: (data as Partial<Creator>).selfiePath ?? null,
      photoPath: (data as Partial<Creator>).photoPath ?? null,
      password: (data as Partial<Creator>).password ?? null,
      phone: (data as Partial<Creator>).phone ?? null,
      provider: (data as Partial<Creator>).provider ?? 'credentials',
      providerId: (data as Partial<Creator>).providerId ?? null,
      nationalId: (data as Partial<Creator>).nationalId ?? null,
    };
    return this.prisma.creator.create({ data: mapped });
  }

  async findByEmail(email: string): Promise<Creator | null> {
    return this.prisma.creator.findUnique({ where: { email } });
  }

  async findByDni(nationalId: string): Promise<Creator | null> {
    return this.prisma.creator.findUnique({ where: { nationalId } });
  }

  async findById(id: string): Promise<Creator | null> {
    return this.prisma.creator.findUnique({ where: { id } });
  }

  async updateVerification(id: string, data: Partial<Creator>) {
    return this.prisma.creator.update({ where: { id }, data });
  }

  /**
   * incrementTokenVersion
   * Incrementa en 1 la versión de token para invalidar refresh tokens existentes.
   */
  async incrementTokenVersion(id: string): Promise<Creator> {
    return this.prisma.creator.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  /**
   * Busca un creador por su proveedor y el ID de ese proveedor
   */
  async findByProvider(provider: string, providerId: string): Promise<Creator | null> {
    // Usa la clave compuesta generada por @@unique([provider, providerId])
    return this.prisma.creator.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
    });
  }
}
