import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// Módulo de Salud del sistema.
// Expone un endpoint simple para verificar disponibilidad del backend.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}