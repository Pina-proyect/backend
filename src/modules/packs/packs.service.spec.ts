import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PacksService } from './packs.service';
import { PrismaService } from 'prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

describe('PacksService', () => {
  let service: PacksService;

  const prisma = {
    contentPack: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    media: {
      count: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    access: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PacksService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PacksService>(PacksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const activePack = { id: 'pack-1', creatorId: 'owner-1', status: 'active' };

  describe('updatePack', () => {
    it('actualiza un pack propio y devuelve media/category', async () => {
      prisma.contentPack.findUnique.mockResolvedValue(activePack);
      prisma.contentPack.update.mockResolvedValue({
        id: 'pack-1',
        title: 'Nuevo título',
        price: 9.99,
        media: [{ id: 'm1' }],
        category: { id: 'cat-1' },
      });

      const result = await service.updatePack('owner-1', 'pack-1', {
        title: 'Nuevo título',
        price: 9.99,
      });

      expect(result.title).toBe('Nuevo título');
      expect(result.media).toHaveLength(1);
      expect(prisma.contentPack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pack-1' },
          data: expect.objectContaining({ title: 'Nuevo título', price: 9.99 }),
          include: { media: true, category: true },
        }),
      );
    });

    it('lanza 404 si el pack no existe', async () => {
      prisma.contentPack.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePack('owner-1', 'pack-1', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si el pack está archivado', async () => {
      prisma.contentPack.findUnique.mockResolvedValue({
        ...activePack,
        status: 'archived',
      });

      await expect(
        service.updatePack('owner-1', 'pack-1', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 403 si el usuario no es el propietario', async () => {
      prisma.contentPack.findUnique.mockResolvedValue(activePack);

      await expect(
        service.updatePack('otro-user', 'pack-1', { title: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.contentPack.update).not.toHaveBeenCalled();
    });

    it('lanza 400 si el body no incluye ningún campo', async () => {
      await expect(service.updatePack('owner-1', 'pack-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza 403 si algún mediaId no pertenece al creador', async () => {
      prisma.contentPack.findUnique.mockResolvedValue(activePack);
      prisma.media.count.mockResolvedValue(1);

      await expect(
        service.updatePack('owner-1', 'pack-1', {
          mediaIds: ['m1', 'm2'],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.contentPack.update).not.toHaveBeenCalled();
    });

    it('reemplaza el set de medios cuando todos pertenecen al creador', async () => {
      prisma.contentPack.findUnique.mockResolvedValue(activePack);
      prisma.media.count.mockResolvedValue(2);
      prisma.contentPack.update.mockResolvedValue({ id: 'pack-1', media: [] });

      await service.updatePack('owner-1', 'pack-1', {
        mediaIds: ['m1', 'm2'],
      });

      expect(prisma.media.count).toHaveBeenCalledWith({
        where: { id: { in: ['m1', 'm2'] }, creatorId: 'owner-1' },
      });
      expect(prisma.contentPack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            media: { set: [{ id: 'm1' }, { id: 'm2' }] },
          }),
        }),
      );
    });
  });

  describe('deletePack', () => {
    it('archiva un pack propio (soft-delete)', async () => {
      prisma.contentPack.findUnique.mockResolvedValue(activePack);
      prisma.contentPack.update.mockResolvedValue({
        ...activePack,
        status: 'archived',
      });

      await service.deletePack('owner-1', 'pack-1');

      expect(prisma.contentPack.update).toHaveBeenCalledWith({
        where: { id: 'pack-1' },
        data: { status: 'archived' },
      });
    });

    it('es idempotente: archivar un pack ya archivado no falla', async () => {
      prisma.contentPack.findUnique.mockResolvedValue({
        ...activePack,
        status: 'archived',
      });
      prisma.contentPack.update.mockResolvedValue({
        ...activePack,
        status: 'archived',
      });

      await expect(
        service.deletePack('owner-1', 'pack-1'),
      ).resolves.toBeUndefined();
      expect(prisma.contentPack.update).toHaveBeenCalledTimes(1);
    });

    it('lanza 403 si el usuario no es el propietario', async () => {
      prisma.contentPack.findUnique.mockResolvedValue(activePack);

      await expect(service.deletePack('otro-user', 'pack-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.contentPack.update).not.toHaveBeenCalled();
    });

    it('lanza 404 si el pack no existe', async () => {
      prisma.contentPack.findUnique.mockResolvedValue(null);

      await expect(service.deletePack('owner-1', 'pack-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyPacks', () => {
    it('excluye los packs archivados del listado del propietario', async () => {
      prisma.contentPack.findMany.mockResolvedValue([]);

      await service.getMyPacks('owner-1');

      expect(prisma.contentPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creatorId: 'owner-1', status: { not: 'archived' } },
        }),
      );
    });
  });

  describe('getPackById', () => {
    it('devuelve el pack cuando está activo', async () => {
      prisma.contentPack.findUnique.mockResolvedValue({
        id: 'pack-1',
        status: 'active',
        media: [],
        category: {},
      });

      const result = await service.getPackById('pack-1');

      expect(result.id).toBe('pack-1');
    });

    it('lanza 404 cuando el pack está archivado', async () => {
      prisma.contentPack.findUnique.mockResolvedValue({
        id: 'pack-1',
        status: 'archived',
      });

      await expect(service.getPackById('pack-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
