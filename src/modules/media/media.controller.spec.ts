import {
  HttpStatus,
  UnsupportedMediaTypeException,
  type ArgumentsHost,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { MediaController, mediaFileFilter } from './media.controller';
import { MediaService, VIDEO_MIMES, IMAGE_MIMES } from './media.service';
import { MediaUrlResolver } from './media-url.resolver';
import { MulterErrorFilter } from '../../common/filters/multer-error.filter';
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
