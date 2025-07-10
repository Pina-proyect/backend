import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { KycResponse } from '../interfaces/kyc-response.interface';
import { RegistrationService } from '../services/registration.service';

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

  @Post('/kyc/reintento')
  async retry(
    @Body() body: { userId: string; selfie: string; idPhoto: string },
  ) {
    return this.registrationService.retryVerification(
      body.userId,
      body.selfie,
      body.idPhoto,
    );
  }
}
