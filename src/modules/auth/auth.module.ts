import { Module } from '@nestjs/common';
import { RegistrationController } from './controllers/registration.controller';
import { RegistrationService } from './services/registration.service';
import { CreatorRepository } from './repositories/creator.repository';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService, CreatorRepository, PrismaService],
})
export class AuthModule {}
