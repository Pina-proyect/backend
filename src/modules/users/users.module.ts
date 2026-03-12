import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { CreatorRepository } from '../auth/repositories/creator.repository';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, CreatorRepository, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}