import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2StorageService } from './r2-storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const env: Record<string, string | undefined> = {
  R2_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_BUCKET: 'pina-private',
  R2_PUBLIC_BUCKET: 'pina-public',
  R2_PUBLIC_URL: 'https://pub.example.com',
  R2_ENDPOINT: 'https://test-account.r2.cloudflarestorage.com',
};

describe('R2StorageService', () => {
  let service: R2StorageService;
  let sendMock: jest.Mock;

  const configMock = {
    get: jest.fn((key: string): string | undefined => env[key]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    sendMock = jest.fn().mockResolvedValue({});
    jest.spyOn(S3Client.prototype, 'send').mockImplementation(sendMock);
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://presigned.example.com/video?X-Amz-Signature=abc',
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        R2StorageService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<R2StorageService>(R2StorageService);
  });

  describe('upload', () => {
    it('sube un video al bucket privado y retorna la key media/<uuid>.<ext>', async () => {
      const key = await service.upload(Buffer.from('video-data'), {
        filename: 'mi-video.mp4',
        mimetype: 'video/mp4',
        type: 'video',
      });

      expect(key).toMatch(/^media\/[0-9a-f-]{36}\.mp4$/);
      expect(sendMock).toHaveBeenCalledTimes(1);
      const sent = sendMock.mock.calls[0] as unknown as PutObjectCommand[];
      const command = sent[0];
      expect(command.input.Bucket).toBe('pina-private');
      expect(command.input.Key).toBe(key);
      expect(command.input.Body).toEqual(Buffer.from('video-data'));
      expect(command.input.ContentType).toBe('video/mp4');
    });

    it('sube una imagen al bucket público y retorna la URL pública', async () => {
      const url = await service.upload(Buffer.from('image-data'), {
        filename: 'cover.png',
        mimetype: 'image/png',
        type: 'image',
      });

      expect(url).toMatch(
        /^https:\/\/pub\.example\.com\/media\/[0-9a-f-]{36}\.png$/,
      );
      expect(sendMock).toHaveBeenCalledTimes(1);
      const sent = sendMock.mock.calls[0] as unknown as PutObjectCommand[];
      const command = sent[0];
      expect(command.input.Bucket).toBe('pina-public');
      expect(command.input.ContentType).toBe('image/png');
    });

    it('lanza 500 con mensaje en español cuando el bucket es inaccesible', async () => {
      sendMock.mockRejectedValue(new Error('NoSuchBucket'));

      await expect(
        service.upload(Buffer.from('data'), {
          filename: 'a.mp4',
          mimetype: 'video/mp4',
          type: 'video',
        }),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.upload(Buffer.from('data'), {
          filename: 'a.mp4',
          mimetype: 'video/mp4',
          type: 'video',
        }),
      ).rejects.toThrow(/Error al subir el archivo/);
    });
  });

  describe('getUrl', () => {
    it('retorna una URL presignada inline con expiresAt por defecto de 30 min (1800s)', async () => {
      const before = Date.now();
      const result = await service.getUrl('media/video-1.mp4');
      const after = Date.now();

      expect(result.url).toBe(
        'https://presigned.example.com/video?X-Amz-Signature=abc',
      );
      const signedOpts = (getSignedUrl as jest.Mock).mock
        .calls[0] as unknown as [
        unknown,
        GetObjectCommand,
        { expiresIn: number },
      ];
      expect(signedOpts[2].expiresIn).toBe(1800);
      expect(signedOpts[1].input.Bucket).toBe('pina-private');
      expect(signedOpts[1].input.Key).toBe('media/video-1.mp4');
      expect(signedOpts[1].input.ResponseContentDisposition).toBe('inline');

      expect(result.expiresAt).toBeDefined();
      const expiresMs = new Date(result.expiresAt as string).getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 600_000);
      expect(expiresMs).toBeLessThanOrEqual(after + 1_800_000);
    });

    it('clampa el TTL al mínimo de 600s cuando se pide menos', async () => {
      await service.getUrl('media/video-1.mp4', 60);
      const opts = (getSignedUrl as jest.Mock).mock.calls[0] as unknown as [
        unknown,
        GetObjectCommand,
        { expiresIn: number },
      ];
      expect(opts[2].expiresIn).toBe(600);
    });

    it('clampa el TTL al máximo de 1800s cuando se pide más', async () => {
      await service.getUrl('media/video-1.mp4', 7200);
      const opts = (getSignedUrl as jest.Mock).mock.calls[0] as unknown as [
        unknown,
        GetObjectCommand,
        { expiresIn: number },
      ];
      expect(opts[2].expiresIn).toBe(1800);
    });

    it('lanza 500 con mensaje en español si el presign falla', async () => {
      (getSignedUrl as jest.Mock).mockRejectedValueOnce(
        new Error('Credentials error'),
      );

      await expect(service.getUrl('media/video-1.mp4')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('delete', () => {
    it('borra por key en el bucket privado', async () => {
      await service.delete('media/video-1.mp4');

      expect(sendMock).toHaveBeenCalledTimes(1);
      const sent = sendMock.mock.calls[0] as unknown as DeleteObjectCommand[];
      const command = sent[0];
      expect(command.input.Bucket).toBe('pina-private');
      expect(command.input.Key).toBe('media/video-1.mp4');
    });

    it('borra por URL pública en el bucket público quitando el prefijo', async () => {
      await service.delete('https://pub.example.com/media/cover-1.png');

      expect(sendMock).toHaveBeenCalledTimes(1);
      const sent = sendMock.mock.calls[0] as unknown as DeleteObjectCommand[];
      const command = sent[0];
      expect(command.input.Bucket).toBe('pina-public');
      expect(command.input.Key).toBe('media/cover-1.png');
    });

    it('ignora referencias que no son key ni URL pública (no-op)', async () => {
      await service.delete('/uploads/legacy.mp4');

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('es idempotente: no lanza si el objeto ya no existe', async () => {
      sendMock.mockRejectedValueOnce(new Error('NoSuchKey'));

      await expect(
        service.delete('media/video-1.mp4'),
      ).resolves.toBeUndefined();
    });
  });
});
