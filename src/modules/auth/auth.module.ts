import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { RegistrationController } from './controllers/registration.controller';
import { RegistrationService } from './services/registration.service';
import { CreatorRepository } from './repositories/creator.repository';
import { PrismaService } from 'prisma/prisma.service';
import { KycProviderService } from './services/kycprovider.service';
import { AuthService } from './services/auth.service';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [PassportModule],
  controllers: [RegistrationController],
  providers: [
    RegistrationService,
    CreatorRepository,
    PrismaService,
    KycProviderService,
    AuthService,
    GoogleStrategy,
  ],
})
export class AuthModule {}
