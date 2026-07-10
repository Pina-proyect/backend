import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import {
  RegistrationService,
  RegistrationResponse,
} from '../services/registration.service';

@Controller('registro')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('creadora')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() data: CreateCreatorDto,
  ): Promise<RegistrationResponse> {
    return this.registrationService.startRegistration(data);
  }
}
