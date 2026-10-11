import { Test, TestingModule } from '@nestjs/testing';
import { PacksController } from './packs.controller';
import { PacksService } from './packs.service';
import { PackAccessGuard } from './guards/pack-access.guard';
import { ConfigService } from '@nestjs/config';
import { MediaUrlResolver } from '../media/media-url.resolver';
import { StorageProvider } from '../storage/storage.provider';
import {
  AuthenticatedRequest,
  OptionalAuthenticatedRequest,
} from '../../common/types/authenticated-request';
import type { Media } from '@prisma/client';

/** Pack con la media ya proyectada por el endpoint (REQ-SVD-5). */
type ProjectedPack = {
  id: string;
  media: Array<Media & { expiresAt?: string }>;
};

/**
 * Contrato de proyección por endpoint (REQ-SVD-3, cierra fuga B1):
 * - `GET /packs/my-packs`  → proyección FIRMADA (videos presignados + expiresAt).
 * - `GET /packs/public/:slug` → proyección PÚBLICA (videos url '').
 * - `GET /packs/:id`       → proyección PÚBLICA.
 */
function makeMedia(overrides: Partial<Media> = {}): Media {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'm1',
    creatorId: 'c1',
    title: 'video uno',
    url: 'media/m1.mp4',
    type: 'video',
    mimetype: 'video/mp4',
    size: 1024,
    isPrivate: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeImage(): Media {
  return makeMedia({
    id: 'i1',
    title: 'portada',
    type: 'image',
    mimetype: 'image/png',
    url: 'https://pub.test/media/i1.png',
    isPrivate: false,
  });
}

describe('PacksController', () => {
  let controller: PacksController;
  let packsService: {
    createPack: jest.Mock;
    getMyPacks: jest.Mock;
    getAllCategories: jest.Mock;
    getPacksByCreatorSlug: jest.Mock;
    getPackById: jest.Mock;
    updatePack: jest.Mock;
    deletePack: jest.Mock;
    grantAccess: jest.Mock;
    hasAccess: jest.Mock;
  };
  let storage: { getUrl: jest.Mock };

  beforeEach(async () => {
    packsService = {
      createPack: jest.fn(),
      getMyPacks: jest.fn(),
      getAllCategories: jest.fn(),
      getPacksByCreatorSlug: jest.fn(),
      getPackById: jest.fn(),
      updatePack: jest.fn(),
      deletePack: jest.fn(),
      grantAccess: jest.fn(),
      hasAccess: jest.fn(),
    };
    storage = { getUrl: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PacksController],
      providers: [
        { provide: PacksService, useValue: packsService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        MediaUrlResolver,
        { provide: StorageProvider, useValue: storage },
        PackAccessGuard,
      ],
    }).compile();

    controller = module.get<PacksController>(PacksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /packs/my-packs (proyección firmada)', () => {
    it('presigna el video y deja la portada pública', async () => {
      storage.getUrl.mockResolvedValue({
        url: 'https://r2.test/signed',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      packsService.getMyPacks.mockResolvedValue([
        { id: 'p1', media: [makeMedia(), makeImage()] },
      ]);

      const result = (await controller.getMyPacks({
        user: { id: 'u1' },
      } as AuthenticatedRequest)) as unknown as ProjectedPack[];

      expect(result[0].media[0].url).toBe('https://r2.test/signed');
      expect(result[0].media[0].expiresAt).toBe('2030-01-01T00:00:00.000Z');
      expect(result[0].media[1].url).toBe('https://pub.test/media/i1.png');
      expect(result[0].media[0]).not.toHaveProperty('resolvedUrl');
    });

    it('no filtra el object key crudo del video como url', async () => {
      storage.getUrl.mockResolvedValue({
        url: 'https://r2.test/signed',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      packsService.getMyPacks.mockResolvedValue([
        { id: 'p1', media: [makeMedia()] },
      ]);

      const result = (await controller.getMyPacks({
        user: { id: 'u1' },
      } as AuthenticatedRequest)) as unknown as ProjectedPack[];

      expect(result[0].media[0].url).not.toBe('media/m1.mp4');
    });
  });

  describe('GET /packs/public/:slug (proyección pública)', () => {
    it('blanquea el video y conserva la portada pública', async () => {
      packsService.getPacksByCreatorSlug.mockResolvedValue([
        { id: 'p1', media: [makeMedia(), makeImage()] },
      ]);

      const result = await controller.getCreatorPacks('creador');

      expect(result[0].media[0].url).toBe('');
      expect(result[0].media[1].url).toBe('https://pub.test/media/i1.png');
    });

    it('no llama al storage para no firmar en contexto público', async () => {
      packsService.getPacksByCreatorSlug.mockResolvedValue([
        { id: 'p1', media: [makeMedia()] },
      ]);

      await controller.getCreatorPacks('creador');

      expect(storage.getUrl).not.toHaveBeenCalled();
    });
  });

  describe('GET /packs/:id (proyección pública + hasAccess)', () => {
    const anonymous = {} as OptionalAuthenticatedRequest;

    it('blanquea el video y conserva la portada', async () => {
      packsService.getPackById.mockResolvedValue({
        id: 'p1',
        media: [makeMedia(), makeImage()],
      });

      const result = await controller.getPack('p1', anonymous);

      expect(result.media[0].url).toBe('');
      expect(result.media[1].url).toBe('https://pub.test/media/i1.png');
    });

    it('request anónimo → hasAccess false sin consultar acceso', async () => {
      packsService.getPackById.mockResolvedValue({ id: 'p1', media: [] });

      const result = await controller.getPack('p1', anonymous);

      expect(result.hasAccess).toBe(false);
      expect(packsService.hasAccess).not.toHaveBeenCalled();
    });

    it('usuario autenticado con acceso → hasAccess true', async () => {
      packsService.getPackById.mockResolvedValue({ id: 'p1', media: [] });
      packsService.hasAccess.mockResolvedValue(true);

      const result = await controller.getPack('p1', {
        user: { id: 'buyer-1' },
      } as OptionalAuthenticatedRequest);

      expect(result.hasAccess).toBe(true);
      expect(packsService.hasAccess).toHaveBeenCalledWith('buyer-1', 'p1');
    });

    it('usuario autenticado sin acceso → hasAccess false', async () => {
      packsService.getPackById.mockResolvedValue({ id: 'p1', media: [] });
      packsService.hasAccess.mockResolvedValue(false);

      const result = await controller.getPack('p1', {
        user: { id: 'other-1' },
      } as OptionalAuthenticatedRequest);

      expect(result.hasAccess).toBe(false);
      expect(packsService.hasAccess).toHaveBeenCalledWith('other-1', 'p1');
    });
  });

  describe('PATCH /packs/:id', () => {
    it('delega en el service con el id del usuario autenticado', async () => {
      packsService.updatePack.mockResolvedValue({ id: 'p1' });
      const dto = { title: 'Nuevo' };

      const result = await controller.updatePack(
        'p1',
        dto,
        { user: { id: 'u1' } } as AuthenticatedRequest,
      );

      expect(packsService.updatePack).toHaveBeenCalledWith('u1', 'p1', dto);
      expect(result).toEqual({ id: 'p1' });
    });
  });

  describe('DELETE /packs/:id', () => {
    it('delega el soft-delete con el id del usuario autenticado', async () => {
      packsService.deletePack.mockResolvedValue(undefined);

      await controller.deletePack('p1', {
        user: { id: 'u1' },
      } as AuthenticatedRequest);

      expect(packsService.deletePack).toHaveBeenCalledWith('u1', 'p1');
    });
  });

  describe('GET /packs/:id/content (proyección firmada)', () => {
    it('presigna el video para un usuario autorizado', async () => {
      storage.getUrl.mockResolvedValue({
        url: 'https://r2.test/signed',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      packsService.getPackById.mockResolvedValue({
        id: 'p1',
        media: [makeMedia(), makeImage()],
      });

      const result = await controller.getPackContent('p1');

      expect(result.media[0].url).toBe('https://r2.test/signed');
      expect(result.media[0].expiresAt).toBe('2030-01-01T00:00:00.000Z');
      expect(result.media[1].url).toBe('https://pub.test/media/i1.png');
    });
  });
});
