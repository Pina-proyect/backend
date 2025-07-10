import { Injectable } from '@nestjs/common';
import { Creator, Prisma } from 'generated/prisma';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CreatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CreatorCreateInput): Promise<Creator> {
    return this.prisma.creator.create({ data });
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
}
