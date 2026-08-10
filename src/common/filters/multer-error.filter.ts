import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';

/**
 * Traduce errores de multer a respuestas HTTP claras en español.
 * LIMIT_FILE_SIZE → 413 (el límite del FileInterceptor es 100MB).
 */
@Catch(MulterError)
export class MulterErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterErrorFilter.name);

  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    this.logger.warn(`Multer error: ${exception.code} ${exception.message}`);

    let status = HttpStatus.BAD_REQUEST;
    let message = 'Error al subir el archivo';

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = 'El archivo supera el límite de 100MB.';
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

    response.status(status).json({
      statusCode: status,
      message,
      code: exception.code,
    });
  }
}
