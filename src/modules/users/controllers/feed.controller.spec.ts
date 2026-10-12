import { Test, TestingModule } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { UsersService } from '../services/users.service';
import { MediaUrlResolver } from '../../media/media-url.resolver';
import { StorageProvider } from '../../storage/storage.provider';
import { AuthenticatedRequest } from '../../../common/types/authenticated-request';
import type { Media } from '@prisma/client';

/**
 * REQ-SVD-3: `GET /feed` es un endpoint de proyección pública →
 * los videos privados quedan con url vacío; las portadas siguen públicas.
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
    visibility: null,
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

describe('FeedController', () => {
  let controller: FeedController;
  let usersService: { getFeed: jest.Mock };
  let storage: { getUrl: jest.Mock };

  beforeEach(async () => {
    usersService = { getFeed: jest.fn() };
    storage = { getUrl: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [
        { provide: UsersService, useValue: usersService },
        MediaUrlResolver,
        { provide: StorageProvider, useValue: storage },
      ],
    }).compile();

    controller = module.get<FeedController>(FeedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('aplica la proyección pública: video url vacío y portada pública', async () => {
    usersService.getFeed.mockResolvedValue([
      { id: 'p1', media: [makeMedia(), makeImage()] },
    ]);

    const result = await controller.getFeed({
      user: { id: 'u1' },
    } as AuthenticatedRequest);

    expect(result[0].media[0].url).toBe('');
    expect(result[0].media[1].url).toBe('https://pub.test/media/i1.png');
  });

  it('no firma nada en contexto público (no toca el storage)', async () => {
    usersService.getFeed.mockResolvedValue([
      { id: 'p1', media: [makeMedia()] },
    ]);

    await controller.getFeed({ user: { id: 'u1' } } as AuthenticatedRequest);

    expect(storage.getUrl).not.toHaveBeenCalled();
  });
});
