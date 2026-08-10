import { Module, Global } from '@nestjs/common';
import { StorageProvider } from './storage.provider';
import { LocalStorageService } from './local-storage.service';
import { R2StorageService } from './r2-storage.service';

/**
 * Factory de driver de almacenamiento.
 * STORAGE_DRIVER=local (default en desarrollo) | r2 (default en producción).
 * Para rollback rápido, cambiar la variable y redeployar.
 */
@Global()
@Module({
  providers: [
    R2StorageService,
    LocalStorageService,
    {
      provide: StorageProvider,
      useFactory: (r2: R2StorageService, local: LocalStorageService) => {
        const driver =
          process.env.STORAGE_DRIVER ??
          (process.env.NODE_ENV === 'production' ? 'r2' : 'local');
        return driver === 'r2' ? r2 : local;
      },
      inject: [R2StorageService, LocalStorageService],
    },
  ],
  exports: [StorageProvider, R2StorageService],
})
export class StorageModule {}
