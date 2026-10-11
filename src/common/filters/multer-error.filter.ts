import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';

/**
 * Traduce errores de subida a respuestas HTTP claras en español.
 *
 * Cubre dos paths (REQ-UL-3):
 * - `MulterError` crudo (cuando multer propaga el error sin convertir): `LIMIT_FILE_SIZE` → 413.
 * - `PayloadTooLargeException` (el `transformException` de NestJS convierte
 *   `LIMIT_FILE_SIZE` en `PayloadTooLargeException('File too large')` ANTES de los
 *   filtros globales): solo se reescribe el mensaje inglés de multer; los 413 que
 *   ya llegan en español desde `MediaService` (imagen >10MB, video >100MB) se preservan.
 */
@Catch(MulterError, PayloadTooLargeException)
export class MulterErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterErrorFilter.name);

  catch(
    exception: MulterError | PayloadTooLargeException,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'Error al subir el archivo';
    let code: string | undefined;

    if (exception instanceof PayloadTooLargeException) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      if (exception.message === 'File too large') {
        message = 'El archivo supera el límite de 100MB.';
        code = 'LIMIT_FILE_SIZE';
      } else {
        message = exception.message;
      }
      this.logger.warn(`Upload rechazado (413): ${message}`);
    } else {
      this.logger.warn(`Multer error: ${exception.code} ${exception.message}`);
      switch (exception.code) {
        case 'LIMIT_FILE_SIZE':
          status = HttpStatus.PAYLOAD_TOO_LARGE;
          message = 'El archivo supera el límite de 100MB.';
          code = 'LIMIT_FILE_SIZE';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          message = 'Campo de archivo inesperado. Usá el campo "file".';
          break;
        case 'LIMIT_FILE_COUNT':
          message = 'Solo se permite un archivo por subida.';
          break;
        default:
          message = exception.message || message;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(code && { code }),
    });
  }
}
