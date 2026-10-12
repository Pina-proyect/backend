import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../services/users.service';
import { MediaUrlResolver } from '../../media/media-url.resolver';
import { AuthenticatedRequest } from '../../../common/types/authenticated-request';

@Controller('feed')
@UseGuards(AuthGuard('jwt'))
export class FeedController {
  constructor(
    private readonly usersService: UsersService,
    private readonly urlResolver: MediaUrlResolver,
  ) {}

  @Get()
  async getFeed(@Req() req: AuthenticatedRequest) {
    // Proyección pública: videos privados con url vacío, portadas públicas (REQ-SVD-3).
    const packs = await this.usersService.getFeed(req.user.id);
    return this.urlResolver.toPublicPacks(packs);
  }
}
