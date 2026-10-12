import {
  Controller,
  HttpStatus,
  Post,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UseInterceptors,
  type ArgumentsHost,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { MulterError } from 'multer';
import * as request from 'supertest';
import { MediaController, mediaFileFilter } from './media.controller';
import { MediaService, VIDEO_MIMES, IMAGE_MIMES } from './media.service';
import { MediaUrlResolver } from './media-url.resolver';
import { MulterErrorFilter } from '../../common/filters/multer-error.filter';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';

/** Ejecuta mediaFileFilter con un mimetype y captura la llamada al callback. */
function runFileFilter(mimetype: string): [Error | null, boolean] {
  let call: [Error | null, boolean] | undefined;
  mediaFileFilter(
    {} as Express.Request,
    { mimetype } as Express.Multer.File,
    (error, acceptFile) => {
      call = [error, acceptFile];
    },
  );
  if (!call) throw new Error('fileFilter nunca llamó al callback');
  return call;
}

describe('MediaController upload (REQ-UL-3)', () => {
  describe('fileFilter (rechazo temprano antes de bufferear)', () => {
    it('rechaza un mime fuera de whitelist con 415 y mensaje en español', () => {
      const [error, accepted] = runFileFilter('application/pdf');

      expect(accepted).toBe(false);
      expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
      expect((error as UnsupportedMediaTypeException).getStatus()).toBe(415);
      expect(
        (
          (error as UnsupportedMediaTypeException).getResponse() as {
            message: string;
          }
        ).message,
      ).toContain('Formato no permitido');
    });

    it('rechaza un mime de video no permitido con 415', () => {
      const [error, accepted] = runFileFilter('video/avi');

      expect(accepted).toBe(false);
      expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
      expect((error as UnsupportedMediaTypeException).getStatus()).toBe(415);
    });

    it.each([...VIDEO_MIMES, ...IMAGE_MIMES])(
      'acepta el mime permitido %s',
      (mimetype) => {
        const [error, accepted] = runFileFilter(mimetype);

        expect(error).toBeNull();
        expect(accepted).toBe(true);
      },
    );
  });

  describe('errores de multer (LIMIT_FILE_SIZE → 413)', () => {
    it('mapea LIMIT_FILE_SIZE a 413 con mensaje en español', () => {
      const filter = new MulterErrorFilter();
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new MulterError('LIMIT_FILE_SIZE', 'file'), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 413,
          message: 'El archivo supera el límite de 100MB.',
          code: 'LIMIT_FILE_SIZE',
        }),
      );
    });

    it('mapea PayloadTooLargeException de multer ("File too large") a 413 en español', () => {
      // NestJS transformException convierte LIMIT_FILE_SIZE en
      // PayloadTooLargeException('File too large') ANTES de los filtros globales.
      const filter = new MulterErrorFilter();
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new PayloadTooLargeException('File too large'), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 413,
          message: 'El archivo supera el límite de 100MB.',
        }),
      );
    });

    it('preserva el 413 con mensaje en español del servicio (imagen >10MB)', () => {
      // El service ya lanza PayloadTooLargeException con mensaje en español;
      // el filtro NO debe reescribirlo ni degradar el status.
      const filter = new MulterErrorFilter();
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
        }),
      } as unknown as ArgumentsHost;

      filter.catch(
        new PayloadTooLargeException('La imagen supera el límite de 10MB.'),
        host,
      );

      expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 413,
          message: 'La imagen supera el límite de 10MB.',
        }),
      );
    });
  });

  describe('wiring real: FileInterceptor + filtros globales de main.ts', () => {
    // Reproduce el probe de verify (WARNING-1): un controller con límite chico
    // ejercita el path real → transformException → PayloadTooLargeException → filtros.
    let app: INestApplication;

    @Controller('probe')
    class OversizeProbeController {
      @Post('oversize')
      @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2048 } }))
      upload() {
        return { ok: true };
      }
    }

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [OversizeProbeController],
      }).compile();

      app = moduleRef.createNestApplication();
      // Mismo wiring global que main.ts.
      app.useGlobalFilters(new GlobalExceptionFilter(new ConfigService()));
      app.useGlobalFilters(new MulterErrorFilter());
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('POST con archivo > límite → 413 con mensaje en español (no "File too large")', async () => {
      const res = await request(app.getHttpServer())
        .post('/probe/oversize')
        .attach('file', Buffer.alloc(4096, 0), {
          filename: 'big.png',
          contentType: 'image/png',
        })
        .expect(HttpStatus.PAYLOAD_TOO_LARGE);

      expect((res.body as { message: string }).message).toContain(
        'supera el límite de 100MB',
      );
    });
  });

  describe('uploadFile', () => {
    it('delega en MediaService.saveMedia con creatorId, file y title', async () => {
      const saveMedia = jest.fn().mockResolvedValue({ id: 'm1' });
      const controller = new MediaController(
        { saveMedia } as unknown as MediaService,
        {} as MediaUrlResolver,
      );
      const file = { mimetype: 'image/png' } as Express.Multer.File;

      const result = await controller.uploadFile(file, 'Mi título', {
        user: { id: 'c1' },
      } as AuthenticatedRequest);

      expect(saveMedia).toHaveBeenCalledWith('c1', file, 'Mi título');
      expect(result).toEqual({ id: 'm1' });
    });
  });
});
