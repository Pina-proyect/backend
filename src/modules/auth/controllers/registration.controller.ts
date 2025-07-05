import { Body, Controller, Post } from '@nestjs/common';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { KycResponse } from '../interfaces/kyc-response.interface';
import { RegistrationService } from '../services/registration.service';

@Controller('registration')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('/register/creator')
  async register(@Body() data: CreateCreatorDto): Promise<KycResponse> {
    return this.registrationService.startRegistration(data);
  }
}
