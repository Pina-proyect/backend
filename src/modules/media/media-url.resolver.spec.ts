import { MediaUrlResolver } from './media-url.resolver';
import { ResolvedUrl, StorageProvider } from '../storage/storage.provider';
import type { Media } from '@prisma/client';

/**
 * Contrato del resolver (REQ-SVD-3/5):
 * - proyección firmada: video → url presignada + expiresAt en el nivel superior.
 * - proyección pública: video → url ''; imagen → url pública.
 * - el campo anidado legacy `resolvedUrl` NUNCA se emite.
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

describe('MediaUrlResolver', () => {
  let resolver: MediaUrlResolver;
  let storage: { getUrl: jest.Mock<Promise<ResolvedUrl>, [string?]> };

  beforeEach(() => {
    storage = { getUrl: jest.fn() };
    resolver = new MediaUrlResolver(storage as unknown as StorageProvider);
  });

  describe('proyección firmada (resolveItem/resolveItems)', () => {
    it('expone url y expiresAt en el nivel superior para un video', async () => {
      storage.getUrl.mockResolvedValue({
        url: 'https://r2.test/signed?v=1',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });

      const result = await resolver.resolveItem(makeMedia());

      expect(result.url).toBe('https://r2.test/signed?v=1');
      expect(result.expiresAt).toBe('2030-01-01T00:00:00.000Z');
      expect(result).not.toHaveProperty('resolvedUrl');
      expect(storage.getUrl).toHaveBeenCalledWith('media/m1.mp4');
    });

    it('deja la url pública intacta para una imagen y no firma ni setea expiresAt', async () => {
      const image = makeMedia({
        id: 'i1',
        type: 'image',
        mimetype: 'image/png',
        url: 'https://pub.test/media/i1.png',
        isPrivate: false,
      });

      const result = await resolver.resolveItem(image);

      expect(result.url).toBe('https://pub.test/media/i1.png');
      expect(result).not.toHaveProperty('expiresAt');
      expect(result).not.toHaveProperty('resolvedUrl');
      expect(storage.getUrl).not.toHaveBeenCalled();
    });

    it('omite expiresAt cuando el storage no firma (local)', async () => {
      storage.getUrl.mockResolvedValue({
        url: 'http://localhost:4000/media/m1.mp4',
      });

      const result = await resolver.resolveItem(makeMedia());

      expect(result.url).toBe('http://localhost:4000/media/m1.mp4');
      expect(result).not.toHaveProperty('expiresAt');
    });

    it('mapea listas mixtas preservando el orden', async () => {
      storage.getUrl.mockResolvedValue({
        url: 'https://r2.test/signed',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      const video = makeMedia();
      const image = makeMedia({
        id: 'i1',
        type: 'image',
        url: 'https://pub.test/media/i1.png',
        isPrivate: false,
      });

      const result = await resolver.resolveItems([video, image]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('m1');
      expect(result[0].url).toBe('https://r2.test/signed');
      expect(result[1].id).toBe('i1');
      expect(result[1].url).toBe('https://pub.test/media/i1.png');
    });
  });

  describe('proyección pública (toPublicItem/toPublicItems)', () => {
    it('blanquea la url de un video privado', () => {
      const result = resolver.toPublicItem(makeMedia());

      expect(result.id).toBe('m1');
      expect(result.url).toBe('');
    });

    it('conserva la url pública de una imagen', () => {
      const image = makeMedia({
        type: 'image',
        url: 'https://pub.test/media/i1.png',
      });

      const result = resolver.toPublicItem(image);

      expect(result.url).toBe('https://pub.test/media/i1.png');
    });

    it('blanquea un object key crudo aunque isPrivate sea false', () => {
      const video = makeMedia({
        isPrivate: false,
        url: 'media/raw-key.mp4',
      });

      const result = resolver.toPublicItem(video);

      expect(result.url).toBe('');
    });

    it('proyecta listas mixtas', () => {
      const video = makeMedia();
      const image = makeMedia({
        id: 'i1',
        type: 'image',
        url: 'https://pub.test/media/i1.png',
      });

      const result = resolver.toPublicItems([video, image]);

      expect(result[0].url).toBe('');
      expect(result[1].url).toBe('https://pub.test/media/i1.png');
    });
  });

  describe('proyección pública por visibilidad (REQ-SVD-3)', () => {
    it('blanquea la url de una imagen exclusive', () => {
      const image = makeMedia({
        id: 'i-excl',
        type: 'image',
        url: 'https://pub.test/media/i-excl.png',
        isPrivate: false,
        visibility: 'exclusive',
      });

      const result = resolver.toPublicItem(image);

      expect(result.url).toBe('');
    });

    it('conserva la url pública de una imagen preview', () => {
      const image = makeMedia({
        id: 'i-prev',
        type: 'image',
        url: 'https://pub.test/media/i-prev.png',
        isPrivate: false,
        visibility: 'preview',
      });

      const result = resolver.toPublicItem(image);

      expect(result.url).toBe('https://pub.test/media/i-prev.png');
    });

    it('preserva el comportamiento actual cuando la visibilidad es null', () => {
      const image = makeMedia({
        id: 'i-null',
        type: 'image',
        url: 'https://pub.test/media/i-null.png',
        isPrivate: false,
        visibility: null,
      });
      const video = makeMedia({ id: 'v-null', visibility: null });

      expect(resolver.toPublicItem(image).url).toBe(
        'https://pub.test/media/i-null.png',
      );
      expect(resolver.toPublicItem(video).url).toBe('');
    });

    it('blanquea un video exclusive (nunca público)', () => {
      const video = makeMedia({ visibility: 'exclusive' });

      const result = resolver.toPublicItem(video);

      expect(result.url).toBe('');
    });

    it('proyecta listas con exclusive y preview', () => {
      const exclusive = makeMedia({
        id: 'i-excl',
        type: 'image',
        url: 'https://pub.test/e.png',
        isPrivate: false,
        visibility: 'exclusive',
      });
      const preview = makeMedia({
        id: 'i-prev',
        type: 'image',
        url: 'https://pub.test/p.png',
        isPrivate: false,
        visibility: 'preview',
      });

      const result = resolver.toPublicItems([exclusive, preview]);

      expect(result[0].url).toBe('');
      expect(result[1].url).toBe('https://pub.test/p.png');
    });

    it('la proyección firmada sigue firmando un video exclusive con expiresAt', async () => {
      storage.getUrl.mockResolvedValue({
        url: 'https://r2.test/signed',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      const video = makeMedia({ visibility: 'exclusive' });

      const result = await resolver.resolveItem(video);

      expect(result.url).toBe('https://r2.test/signed');
      expect(result.expiresAt).toBe('2030-01-01T00:00:00.000Z');
    });
  });

  describe('isNonPublic', () => {
    it('detecta object keys crudos y acepta urls públicas', () => {
      expect(resolver.isNonPublic('media/abc.mp4')).toBe(true);
      expect(resolver.isNonPublic('https://r2.test/x')).toBe(false);
      expect(resolver.isNonPublic('http://localhost:4000/media/x.mp4')).toBe(
        false,
      );
      expect(resolver.isNonPublic('/uploads/x.mp4')).toBe(false);
    });
  });

  describe('helpers de packs (resolvePacks/toPublicPacks)', () => {
    it('firma la media de cada pack sin acoplarse al tipo de pack', async () => {
      storage.getUrl.mockResolvedValue({
        url: 'https://r2.test/signed',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      const packs = [{ id: 'p1', title: 'Pack', media: [makeMedia()] }];

      const result = await resolver.resolvePacks(packs);

      expect(result[0].title).toBe('Pack');
      expect(result[0].media[0].url).toBe('https://r2.test/signed');
      expect(result[0].media[0].expiresAt).toBe('2030-01-01T00:00:00.000Z');
    });

    it('aplica la proyección pública a cada pack', () => {
      const packs = [{ id: 'p1', media: [makeMedia()] }];

      const result = resolver.toPublicPacks(packs);

      expect(result[0].media[0].url).toBe('');
    });
  });
});
