import { Injectable } from '@nestjs/common';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { KycResponse } from '../interfaces/kyc-response.interface';
import { CreatorRepository } from '../repositories/creator.repository';

@Injectable()
export class RegistrationService {
  constructor(private readonly creatorRepository: CreatorRepository) {}

  async startRegistration(data: CreateCreatorDto): Promise<KycResponse> {
    // TODO: validate age > 18, upload files, call KYC provider
    const creator = await this.creatorRepository.create({
      fullName: data.fullName,
      email: data.email,
      nationalId: data.nationalId,
      birthDate: new Date(data.birthDate),
      verificationStatus: 'pending',
      selfiePath: '', // to be replaced with actual S3 path
      photoPath: '', // to be replaced with actual S3 path
    });

    return {
      status: 'pending',
      message: 'Verification started',
      userId: creator.id,
    };
  }
}
