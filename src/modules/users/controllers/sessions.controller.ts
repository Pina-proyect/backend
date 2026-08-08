import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../services/users.service';
import { AuthenticatedRequest } from '../../../common/types/authenticated-request';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class SessionsController {
  constructor(private readonly usersService: UsersService) {}

  @Get('sessions')
  async getSessions(@Req() req: AuthenticatedRequest) {
    return this.usersService.getSessions(req.user.id);
  }
}
