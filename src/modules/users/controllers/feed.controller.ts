import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../services/users.service';

@Controller('feed')
@UseGuards(AuthGuard('jwt'))
export class FeedController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getFeed(@Req() req: any) {
    return this.usersService.getFeed(req.user.id);
  }
}
