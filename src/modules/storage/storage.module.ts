import { Module, Global } from '@nestjs/common';
import { StorageProvider } from './storage.provider';
import { LocalStorageService } from './local-storage.service';

@Global()
@Module({
  providers: [
    {
      provide: StorageProvider,
      useClass: LocalStorageService, // En el futuro podemos cambiar esto condicionalmente por GCS o S3
    },
  ],
  exports: [StorageProvider],
})
export class StorageModule {}
