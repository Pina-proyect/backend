import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { differenceInYears } from 'date-fns';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { CreatorRepository } from '../repositories/creator.repository';
import {
  KycResponse,
  VerificationStatus,
} from '../interfaces/kyc-response.interface';
import { KycProviderService } from './kycprovider.service';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly kycProvider: KycProviderService,
  ) {}

  async startRegistration(data: CreateCreatorDto): Promise<KycResponse> {
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

    const existingByDni = await this.creatorRepository.findByDni(
      data.nationalId,
    );
    if (existingByDni) {
      throw new BadRequestException(
        `Ya existe un creador registrado con el DNI ${data.nationalId}`,
      );
    }

    const creator = await this.creatorRepository.create({
      fullName: data.fullName,
      email: data.email,
      nationalId: data.nationalId,
      birthDate: new Date(data.birthDate),
      verificationStatus: 'pending',
      selfiePath: data.selfiePath,
      photoPath: data.photoPath,
    });

    // simular verificación asíncrona
    void this.verifyInBackground(creator.id);

    return {
      status: 'pending',
      message: 'Verification started',
      userId: creator.id,
    };
  }

  private async verifyInBackground(userId: string) {
    const creator = await this.creatorRepository.findById(userId);
    if (!creator) return;

    const result = await this.kycProvider.verifyDocuments(creator);

    await this.creatorRepository.updateVerification(userId, {
      verificationStatus: result,
    });
  }

  async getStatus(userId: string): Promise<KycResponse> {
    const creator = await this.creatorRepository.findById(userId);
    if (!creator) throw new NotFoundException('Usuario no encontrado');
    const status = creator.verificationStatus as VerificationStatus;
    return {
      userId,
      status,
      message: `Estado: ${status}`,
    };
  }

  async retryVerification(
    userId: string,
    selfiePath: string,
    photoPath: string,
  ): Promise<KycResponse> {
    await this.creatorRepository.updateVerification(userId, {
      selfiePath: selfiePath,
      photoPath: photoPath,
      verificationStatus: 'pending',
    });

    void this.verifyInBackground(userId);

    return {
      userId,
      status: 'pending',
      message: 'Nuevo intento de verificación iniciado',
    };
  }
}
