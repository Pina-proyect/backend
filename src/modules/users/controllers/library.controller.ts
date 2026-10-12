import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../services/users.service';
import { MediaUrlResolver } from '../../media/media-url.resolver';
import { AuthenticatedRequest } from '../../../common/types/authenticated-request';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class LibraryController {
  constructor(
    private readonly usersService: UsersService,
    private readonly urlResolver: MediaUrlResolver,
  ) {}

  @Get('library')
  async getLibrary(@Req() req: AuthenticatedRequest) {
    // Contenido autenticado → proyección firmada (videos presignados, REQ-SVD-3).
    const packs = await this.usersService.getLibrary(req.user.id);
    return this.urlResolver.resolvePacks(packs);
  }
}
