import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma, Creator } from '@prisma/client';

@Injectable()
export class CreatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CreatorCreateInput): Promise<Creator> {
    return await this.prisma.creator.create({ data });
  }

  async findByEmail(email: string): Promise<Creator | null> {
    return await this.prisma.creator.findUnique({ where: { email } });
  }

  // Add more methods as needed...
}
