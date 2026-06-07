import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : typeof res === 'object' && res !== null && 'message' in res
            ? String((res as Record<string, unknown>).message)
            : exception.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    this.logger.error(
      `[${request.method}] ${request.url} → ${status}`,
      exception instanceof Error ? exception.stack : '',
    );

    let code: string | undefined;
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'code' in res) {
        code = String((res as Record<string, unknown>).code);
      }
    }

    if (isProduction && status < 500) {
      message = this.sanitizeClientMessage(status, message);
    }

    response.status(status).json({
      statusCode: status,
      message: isProduction && status >= 500 ? 'Internal server error' : message,
      ...(code && { code }),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private sanitizeClientMessage(status: number, _message: string): string {
    const genericMessages: Record<number, string> = {
      [HttpStatus.UNAUTHORIZED]: 'No autorizado',
      [HttpStatus.FORBIDDEN]: 'Acceso denegado',
      [HttpStatus.NOT_FOUND]: 'No encontrado',
      [HttpStatus.CONFLICT]: 'Conflicto',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Demasiadas solicitudes',
    };
    return genericMessages[status] ?? _message;
  }
}
