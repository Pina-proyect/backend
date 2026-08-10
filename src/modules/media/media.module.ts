import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaUrlResolver } from './media-url.resolver';
import { PrismaService } from 'prisma/prisma.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [MediaController],
  providers: [MediaService, MediaUrlResolver, PrismaService],
  exports: [MediaService, MediaUrlResolver],
})
export class MediaModule {}
