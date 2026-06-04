import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { differenceInYears } from 'date-fns';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { CreatorRepository } from '../repositories/creator.repository';
import { EmailService } from '../../email/email.service';

export interface RegistrationResponse {
  userId: string;
  status: string;
  message: string;
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async startRegistration(data: CreateCreatorDto): Promise<RegistrationResponse> {
    const age = differenceInYears(new Date(), new Date(data.birthDate));
    if (age < 18) {
      throw new BadRequestException(
        'Debes tener al menos 18 años para registrarte.',
      );
    }

    const existingByEmail = await this.creatorRepository.findByEmail(
      data.email,
    );
    if (existingByEmail) {
      throw new BadRequestException(
        `Ya existe un creador registrado con el email ${data.email}`,
      );
    }

    if (data.nationalId) {
      const existingByDni = await this.creatorRepository.findByDni(
        data.nationalId,
      );
      if (existingByDni) {
        throw new BadRequestException(
          `Ya existe un creador registrado con el DNI ${data.nationalId}`,
        );
      }
    }

    // Si password viene informada, la hasheamos antes de persistir
    const saltRoundsRaw = this.config.get<string>('BCRYPT_SALT_ROUNDS');
    const saltRounds = saltRoundsRaw ? Number(saltRoundsRaw) : 10;
    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, saltRounds)
      : null;

    const creator = await this.creatorRepository.create({
      fullName: data.fullName,
      email: data.email,
      nationalId: data.nationalId,
      birthDate: new Date(data.birthDate),
      verificationStatus: data.role === 'CONSUMER' ? 'verified' : 'pending',
      selfiePath: data.selfiePath,
      photoPath: data.photoPath,
      password: hashedPassword,
      role: data.role,
    });

    if (data.role !== 'CONSUMER') {
      const verificationToken = randomBytes(32).toString('hex');
      const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await this.creatorRepository.update(creator.id, {
        verificationToken,
        verificationTokenExpires,
      } as any);

      await this.emailService.sendVerificationEmail(creator.email, verificationToken);
    } else {
      await this.creatorRepository.update(creator.id, {
        emailVerified: true,
      } as any);
    }

    return {
      status: 'success',
      message: data.role === 'CONSUMER'
        ? 'Registro completado con éxito.'
        : 'Registro completado. Revisa tu email para verificar tu cuenta.',
      userId: creator.id,
    };
  }
}
