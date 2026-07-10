import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { CreatorsController } from './controllers/creators.controller';
import { LibraryController } from './controllers/library.controller';
import { SessionsController } from './controllers/sessions.controller';
import { FeedController } from './controllers/feed.controller';
import { UsersService } from './services/users.service';
import { CreatorsService } from './services/creators.service';
import { CreatorRepository } from '../auth/repositories/creator.repository';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [
    UsersController,
    CreatorsController,
    LibraryController,
    SessionsController,
    FeedController,
  ],
  providers: [UsersService, CreatorsService, CreatorRepository, PrismaService],
  exports: [UsersService, CreatorsService],
})
export class UsersModule {}
