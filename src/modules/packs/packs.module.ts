import { Module } from '@nestjs/common';
import { PacksService } from './packs.service';
import { PacksController } from './packs.controller';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  providers: [PacksService, PrismaService],
  controllers: [PacksController],
})
export class PacksModule {}
