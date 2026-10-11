import { Test, TestingModule } from '@nestjs/testing';
import { LibraryController } from './library.controller';
import { UsersService } from '../services/users.service';
import { MediaUrlResolver } from '../../media/media-url.resolver';
import { StorageProvider } from '../../storage/storage.provider';
import { AuthenticatedRequest } from '../../../common/types/authenticated-request';
import type { Media } from '@prisma/client';

/** Pack con la media ya proyectada por el endpoint (REQ-SVD-5). */
type ProjectedPack = {
  id: string;
  media: Array<Media & { expiresAt?: string }>;
};

/**
 * REQ-SVD-3: `GET /users/library` es un endpoint de contenido autenticado →
 * proyección FIRMADA (videos privados presignados + expiresAt; portadas públicas).
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

describe('LibraryController', () => {
  let controller: LibraryController;
  let usersService: { getLibrary: jest.Mock };
  let storage: { getUrl: jest.Mock };

  beforeEach(async () => {
    usersService = { getLibrary: jest.fn() };
    storage = { getUrl: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LibraryController],
      providers: [
        { provide: UsersService, useValue: usersService },
        MediaUrlResolver,
        { provide: StorageProvider, useValue: storage },
      ],
    }).compile();

    controller = module.get<LibraryController>(LibraryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('presigna los videos de la biblioteca y deja las portadas públicas', async () => {
    storage.getUrl.mockResolvedValue({
      url: 'https://r2.test/signed',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    usersService.getLibrary.mockResolvedValue([
      { id: 'p1', media: [makeMedia(), makeImage()] },
    ]);

    const result = (await controller.getLibrary({
      user: { id: 'u1' },
    } as AuthenticatedRequest)) as unknown as ProjectedPack[];

    expect(result[0].media[0].url).toBe('https://r2.test/signed');
    expect(result[0].media[0].expiresAt).toBe('2030-01-01T00:00:00.000Z');
    expect(result[0].media[1].url).toBe('https://pub.test/media/i1.png');
  });

  it('no expone el object key crudo del video como url', async () => {
    storage.getUrl.mockResolvedValue({
      url: 'https://r2.test/signed',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    usersService.getLibrary.mockResolvedValue([
      { id: 'p1', media: [makeMedia()] },
    ]);

    const result = (await controller.getLibrary({
      user: { id: 'u1' },
    } as AuthenticatedRequest)) as unknown as ProjectedPack[];

    expect(result[0].media[0].url).not.toBe('media/m1.mp4');
    expect(result[0].media[0]).not.toHaveProperty('resolvedUrl');
  });
});
