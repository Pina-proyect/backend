import { Module } from '@nestjs/common';
import { RegistrationController } from './controllers/registration.controller';
import { RegistrationService } from './services/registration.service';
import { CreatorRepository } from './repositories/creator.repository';
import { PrismaService } from 'prisma/prisma.service';
import { KycProviderService } from './services/kycprovider.service';

@Module({
  controllers: [RegistrationController],
  providers: [
    RegistrationService,
    CreatorRepository,
    PrismaService,
    KycProviderService,
  ],
})
export class AuthModule {}
