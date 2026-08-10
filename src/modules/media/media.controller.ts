import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Body,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { MediaService, VIDEO_MAX_BYTES } from './media.service';
import { MediaUrlResolver } from './media-url.resolver';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('media')
@UseGuards(AuthGuard('jwt'))
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly urlResolver: MediaUrlResolver,
  ) {}

  @Post('upload')
  // El límite global 100 req/min choca con uploads pesados → excepción.
  @SkipThrottle()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: VIDEO_MAX_BYTES },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mediaService.saveMedia(req.user.id, file, title);
  }

  @Get('my-content')
  async getMyContent(@Req() req: AuthenticatedRequest) {
    const media = await this.mediaService.getMediaByCreator(req.user.id);
    return this.urlResolver.resolveMany(media);
  }

  @Post('delete')
  async deleteMedia(
    @Body('id') mediaId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mediaService.deleteMedia(req.user.id, mediaId);
  }
}
