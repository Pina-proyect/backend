import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { RegistrationController } from './controllers/registration.controller';
import { AuthController } from './controllers/auth.controller';
import { RegistrationService } from './services/registration.service';
import { CreatorRepository } from './repositories/creator.repository';
import { PrismaService } from 'prisma/prisma.service';
import { KycProviderService } from './services/kycprovider.service';
import { AuthService } from './services/auth.service';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'DUMMY_JWT_SECRET',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    }),
  ],
  controllers: [RegistrationController, AuthController],
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
