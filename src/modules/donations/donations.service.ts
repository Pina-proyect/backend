import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class DonationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Métodos futuros para gestionar donaciones desde el dashboard
}
