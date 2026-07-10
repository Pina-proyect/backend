import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreatorsService } from '../services/creators.service';

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Post(':id/follow')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async follow(@Req() req: any, @Param('id') creatorId: string) {
    await this.creatorsService.follow(req.user.id, creatorId);
    return { success: true };
  }

  @Delete(':id/follow')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async unfollow(@Req() req: any, @Param('id') creatorId: string) {
    await this.creatorsService.unfollow(req.user.id, creatorId);
    return { success: true };
  }

  @Get(':id/followers-count')
  async getFollowersCount(@Param('id') creatorId: string) {
    const count = await this.creatorsService.getFollowersCount(creatorId);
    return { count };
  }
}
