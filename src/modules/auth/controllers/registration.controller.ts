import { Body, Controller, Post } from '@nestjs/common';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { RegistrationService, RegistrationResponse } from '../services/registration.service';

@Controller('registro')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('creadora')
  async register(@Body() data: CreateCreatorDto): Promise<RegistrationResponse> {
    return this.registrationService.startRegistration(data);
  }
}
