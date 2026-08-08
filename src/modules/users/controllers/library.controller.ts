import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../services/users.service';
import { AuthenticatedRequest } from '../../../common/types/authenticated-request';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class LibraryController {
  constructor(private readonly usersService: UsersService) {}

  @Get('library')
  async getLibrary(@Req() req: AuthenticatedRequest) {
    return this.usersService.getLibrary(req.user.id);
  }
}
