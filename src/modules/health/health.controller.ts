import { Controller, Get } from '@nestjs/common';

/**
 * HealthController
 * Endpoint de salud para monitoreo básico.
 * Ruta final: GET /pina/health
 */
@Controller('health')
export class HealthController {
  /**
   * Devuelve un estado básico del backend.
   * Nota: En producción, se puede extender con chequeos de DB/Redis.
   */
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || 'unknown',
    };
  }
}