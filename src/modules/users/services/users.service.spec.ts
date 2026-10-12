import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'prisma/prisma.service';
import { CreatorRepository } from '../../auth/repositories/creator.repository';

/**
 * Specs de `UsersService.getLibrary` (spec packs-unlock, REQ-4 "GET /users/library
 * como fuente única de purchasedPacks"):
 * - escenario "Usuario con packs comprados": orden por `createdAt desc`
 *   (consulta con `orderBy` descendente y preservación del orden en el mapeo).
 * - escenario "Usuario sin compras": `getLibrary` resuelve `[]`.
 *
 * Esta es la capa de servicio donde vive la consulta real; el contrato HTTP
 * (200 con lista vacía) se cubre en el e2e `test/packs.e2e-spec.ts`.
 */
describe('UsersService', () => {
  let service: UsersService;

  const prisma = {
    access: {
      findMany: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
    },
    follow: {
      findMany: jest.fn(),
    },
    contentPack: {
      findMany: jest.fn(),
    },
  };

  const creatorRepository = {
    findBySlug: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    search: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreatorRepository, useValue: creatorRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLibrary', () => {
    it('consulta los accesos con orderBy createdAt desc y devuelve los packs en ese orden', async () => {
      const older = {
        id: 'access-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        pack: { id: 'p1', title: 'pack viejo' },
      };
      const newer = {
        id: 'access-2',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        pack: { id: 'p2', title: 'pack reciente' },
      };
      // La DB devuelve los accesos ya ordenados por `createdAt desc`
      // (acceso más reciente primero); el mapeo debe preservar ese orden.
      prisma.access.findMany.mockResolvedValue([newer, older]);

      const result = await service.getLibrary('u1');

      expect(prisma.access.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id)).toEqual(['p2', 'p1']);
    });

    it('devuelve [] cuando el usuario no tiene registros de acceso', async () => {
      prisma.access.findMany.mockResolvedValue([]);

      const result = await service.getLibrary('u1');

      expect(result).toEqual([]);
      expect(prisma.access.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
    });
  });
});
