import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Body,
  Req,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import {
  MediaService,
  VIDEO_MAX_BYTES,
  VIDEO_MIMES,
  IMAGE_MIMES,
} from './media.service';
import { MediaUrlResolver } from './media-url.resolver';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';

/** Whitelist completa de mimes aceptados (REQ-UL-2, decisión D6: incluye GIF). */
export const ALLOWED_MEDIA_MIMES = [...VIDEO_MIMES, ...IMAGE_MIMES];

/**
 * fileFilter del FileInterceptor: rechaza mimes fuera de whitelist con 415
 * ANTES de bufferear el cuerpo completo (REQ-UL-3).
 */
export function mediaFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (ALLOWED_MEDIA_MIMES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(
    new UnsupportedMediaTypeException(
      'Formato no permitido. Usá MP4, WebM, JPG, PNG, WebP o GIF.',
    ),
    false,
  );
}

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
      fileFilter: mediaFileFilter,
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
    return this.urlResolver.resolveItems(media);
  }

  @Post('delete')
  async deleteMedia(
    @Body('id') mediaId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mediaService.deleteMedia(req.user.id, mediaId);
  }
}
