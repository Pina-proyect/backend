import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Body,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(AuthGuard('jwt'))
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Req() req: any,
  ) {
    return this.mediaService.saveMedia(req.user.id, file, title);
  }

  @Get('my-content')
  async getMyContent(@Req() req: any) {
    return this.mediaService.getMediaByCreator(req.user.id);
  }

  @Post('delete')
  async deleteMedia(@Body('id') mediaId: string, @Req() req: any) {
    return this.mediaService.deleteMedia(req.user.id, mediaId);
  }
}
