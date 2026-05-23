import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller';
import { RegistrationService } from './services/registration.service';
import { CreatorRepository } from './repositories/creator.repository';
import { PrismaService } from 'prisma/prisma.service';
import { AuthService } from './services/auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'DUMMY_JWT_SECRET',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegistrationService,
    CreatorRepository,
    PrismaService,
    AuthService,
    GoogleStrategy,
    JwtStrategy,
  ],
})
export class AuthModule {}
