import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  MediaService,
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  VIDEO_MIMES,
  IMAGE_MIMES,
} from './media.service';
import { StorageOptions } from '../storage/storage.provider';
import { PrismaService } from 'prisma/prisma.service';

type MediaCreateParams = {
  data: {
    creatorId: string;
    title: string;
    url: string;
    type: string;
    mimetype: string;
    size: number;
  };
};

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'archivo.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('data'),
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  } as Express.Multer.File;
}

/** Ejecuta la promesa y devuelve el error (falla si la promesa resuelve). */
async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('MediaService.saveMedia (REQ-UL-2/3)', () => {
  let service: MediaService;
  let storage: {
    upload: jest.Mock;
    delete: jest.Mock;
    getUrl: jest.Mock;
  };
  let prisma: {
    media: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    storage = {
      upload: jest.fn().mockResolvedValue('media/x.png'),
      delete: jest.fn(),
      getUrl: jest.fn(),
    };
    prisma = {
      media: {
        create: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new MediaService(storage, prisma as unknown as PrismaService);
  });

  describe('whitelist de mimes (REQ-UL-2)', () => {
    it('incluye exactamente los mimes de REQ-UL-2 y conserva image/gif (D6)', () => {
      expect(VIDEO_MIMES).toEqual(['video/mp4', 'video/webm']);
      expect(IMAGE_MIMES).toEqual([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ]);
    });
  });

  describe('mime fuera de whitelist → 415 (nunca 500)', () => {
    it('rechaza un mime de imagen no permitido con 415 y mensaje en español', async () => {
      const file = makeFile({
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
      });

      const error = await captureError(service.saveMedia('c1', file));

      expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
      expect((error as UnsupportedMediaTypeException).getStatus()).toBe(415);
      expect(
        (
          (error as UnsupportedMediaTypeException).getResponse() as {
            message: string;
          }
        ).message,
      ).toContain('Formato de imagen no permitido');
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rechaza un mime de video no permitido con 415', async () => {
      const file = makeFile({
        originalname: 'clip.avi',
        mimetype: 'video/avi',
      });

      const error = await captureError(service.saveMedia('c1', file));

      expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
      expect((error as UnsupportedMediaTypeException).getStatus()).toBe(415);
      expect(
        (
          (error as UnsupportedMediaTypeException).getResponse() as {
            message: string;
          }
        ).message,
      ).toContain('Formato de video no permitido');
    });
  });

  describe('límite de tamaño → 413', () => {
    it('rechaza una imagen mayor a 10MB con 413 y mensaje en español', async () => {
      const file = makeFile({ size: IMAGE_MAX_BYTES + 1 });

      const error = await captureError(service.saveMedia('c1', file));

      expect(error).toBeInstanceOf(PayloadTooLargeException);
      expect((error as PayloadTooLargeException).getStatus()).toBe(413);
      expect(
        (
          (error as PayloadTooLargeException).getResponse() as {
            message: string;
          }
        ).message,
      ).toContain('La imagen supera el límite de 10MB');
    });

    it('rechaza un video mayor a 100MB con 413', async () => {
      const file = makeFile({
        originalname: 'clip.mp4',
        mimetype: 'video/mp4',
        size: VIDEO_MAX_BYTES + 1,
      });

      const error = await captureError(service.saveMedia('c1', file));

      expect(error).toBeInstanceOf(PayloadTooLargeException);
      expect((error as PayloadTooLargeException).getStatus()).toBe(413);
      expect(
        (
          (error as PayloadTooLargeException).getResponse() as {
            message: string;
          }
        ).message,
      ).toContain('El video supera el límite de 100MB');
    });
  });

  describe('archivos válidos', () => {
    it('sube y persiste una imagen permitida', async () => {
      const file = makeFile();
      const result = await service.saveMedia('c1', file, 'Mi imagen');

      expect(storage.upload).toHaveBeenCalledTimes(1);
      const [uploadedBuffer, options] = storage.upload.mock.calls[0] as [
        Buffer,
        StorageOptions,
      ];
      expect(uploadedBuffer).toBe(file.buffer);
      expect(options.filename).toMatch(/^\d+-archivo\.png$/);
      expect(options.mimetype).toBe('image/png');
      expect(options.type).toBe('image');

      const [createArgs] = prisma.media.create.mock.calls[0] as [
        MediaCreateParams,
      ];
      expect(createArgs.data).toMatchObject({
        creatorId: 'c1',
        title: 'Mi imagen',
        url: 'media/x.png',
        type: 'image',
        mimetype: 'image/png',
        size: 1024,
      });
      expect(result).toEqual({ id: 'm1' });
    });

    it('sube y persiste un video permitido', async () => {
      const file = makeFile({
        originalname: 'clip.mp4',
        mimetype: 'video/mp4',
      });

      const result = await service.saveMedia('c1', file);

      expect(storage.upload).toHaveBeenCalledTimes(1);
      const [uploadedBuffer, options] = storage.upload.mock.calls[0] as [
        Buffer,
        StorageOptions,
      ];
      expect(uploadedBuffer).toBe(file.buffer);
      expect(options.mimetype).toBe('video/mp4');
      expect(options.type).toBe('video');

      const [createArgs] = prisma.media.create.mock.calls[0] as [
        MediaCreateParams,
      ];
      expect(createArgs.data).toMatchObject({
        title: 'clip.mp4',
        type: 'video',
        mimetype: 'video/mp4',
        size: 1024,
      });
      expect(result).toEqual({ id: 'm1' });
    });
  });
});
