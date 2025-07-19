import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { KycResponse } from '../interfaces/kyc-response.interface';
import { RegistrationService } from '../services/registration.service';
import { RetryVerificationDto } from '../dto/retry-verification.dto';

@Controller('/registro')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('/creadora')
  async register(@Body() data: CreateCreatorDto): Promise<KycResponse> {
    return this.registrationService.startRegistration(data);
  }

  @Get('/kyc/estado/:id')
  async getEstado(@Param('id') id: string) {
    return this.registrationService.getStatus(id);
  }

  @Put('/kyc/reintento')
  async retry(@Body() body: RetryVerificationDto) {
    return this.registrationService.retryVerification(
      body.userId,
      body.selfiePath,
      body.photoPath,
    );
  }
}
