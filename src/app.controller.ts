import { Controller, Get, Query, InternalServerErrorException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('seed-test-users')
  async seedTestUsers(@Query('token') token: string) {
    if (token !== 'pina-seed-2026') {
      return { error: 'token inválido' };
    }

    // 1. Borrar usuarios que no completaron registro (sin slug, sin onboarding)
    const deleteResult = await this.prisma.creator.deleteMany({
      where: {
        OR: [
          { slug: null },
          { slug: '' },
          { fullName: { in: ['Lorem Ipsum', 'Martin Di Paolo'] } },
        ],
        provider: 'google',
      },
    });

    // 2. Crear usuarios de prueba
    const testUsers = [
      { fullName: 'Luna Estrella', email: 'luna@test.pina', password: 'Test1234', slug: 'luna-estrella', niche: 'photography', gender: 'creadora' },
      { fullName: 'Sofia Martinez', email: 'sofia@test.pina', password: 'Test1234', slug: 'sofia-martinez', niche: 'digital-art', gender: 'creadora' },
      { fullName: 'Valentina Ruiz', email: 'vale@test.pina', password: 'Test1234', slug: 'valentina-ruiz', niche: 'film', gender: 'creadora' },
      { fullName: 'Camila Lopez', email: 'cami@test.pina', password: 'Test1234', slug: 'camila-lopez', niche: 'photography', gender: 'creadora' },
      { fullName: 'Martina Diaz', email: 'martina@test.pina', password: 'Test1234', slug: 'martina-diaz', niche: 'digital-art', gender: 'creadora' },
    ];

    const created: any[] = [];
    for (const u of testUsers) {
      const existing = await this.prisma.creator.findUnique({ where: { email: u.email } });
      if (existing) {
        created.push({ nombre: u.fullName, email: u.email, password: u.password, slug: u.slug, id: existing.id, status: 'ya existía' });
        continue;
      }
      const hashed = await bcrypt.hash(u.password, 10);
      const creator = await this.prisma.creator.create({
        data: {
          fullName: u.fullName,
          email: u.email,
          password: hashed,
          slug: u.slug,
          niche: u.niche,
          gender: u.gender,
          birthDate: new Date('2000-01-01'),
          role: 'CREATOR',
          verificationStatus: 'verified',
          emailVerified: true,
          acknowledgedAge: true,
          provider: 'credentials',
          pinaPrice: 1000,
        },
      });
      created.push({ nombre: u.fullName, email: u.email, password: u.password, slug: u.slug, id: creator.id, status: 'creado' });
    }

    return {
      deletedCount: deleteResult.count,
      users: created,
    };
  }
}
