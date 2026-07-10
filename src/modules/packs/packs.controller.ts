import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Req,
  Param,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { PacksService } from './packs.service';
import { PackAccessGuard } from './guards/pack-access.guard';
import { CreatePackDto } from './dto/create-pack.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('packs')
export class PacksController {
  constructor(
    private readonly packsService: PacksService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async createPack(@Req() req: any, @Body() data: CreatePackDto) {
    if (req.user.verificationStatus !== 'verified') {
      throw new ForbiddenException(
        'Debes verificar tu identidad antes de crear un paquete de contenido.',
      );
    }
    const creatorId = req.user.id;
    return this.packsService.createPack(creatorId, data);
  }

  @Get('my-packs')
  @UseGuards(AuthGuard('jwt'))
  async getMyPacks(@Req() req: any) {
    return this.packsService.getMyPacks(req.user.id);
  }

  @Get('categories')
  async getCategories() {
    return this.packsService.getAllCategories();
  }

  @Get('public/:slug')
  async getCreatorPacks(@Param('slug') slug: string) {
    return this.packsService.getPacksByCreatorSlug(slug);
  }

  @Get(':id')
  async getPack(@Param('id') id: string) {
    const pack = await this.packsService.getPackById(id);

    // Ocultar URLs de archivos multimedia privados para no filtrarlos públicamente
    const publicMedia = pack.media.map((item) => ({
      ...item,
      url: item.isPrivate ? '' : item.url,
    }));

    return {
      ...pack,
      media: publicMedia,
      hasAccess: false,
    };
  }

  @Get(':id/content')
  @UseGuards(AuthGuard('jwt'), PackAccessGuard)
  async getPackContent(@Param('id') id: string) {
    // Retorna el pack completo con URLs reales si el guard autoriza el acceso
    const pack = await this.packsService.getPackById(id);
    return {
      ...pack,
      hasAccess: true,
    };
  }

  @Post('simulate-purchase')
  @UseGuards(AuthGuard('jwt'))
  async simulatePurchase(@Body('packId') packId: string, @Req() req: any) {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }
    return this.packsService.grantAccess(req.user.id, packId);
  }

  @Get(':id/comments')
  async getComments(@Param('id') packId: string) {
    return this.packsService.getComments(packId);
  }

  @Post(':id/comments')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Param('id') packId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.packsService.createComment(packId, req.user.id, dto.content);
  }

  @Patch('comments/:id')
  @UseGuards(AuthGuard('jwt'))
  async updateComment(
    @Param('id') commentId: string,
    @Body() dto: UpdateCommentDto,
    @Req() req: any,
  ) {
    return this.packsService.updateComment(commentId, req.user.id, dto.content);
  }

  @Delete('comments/:id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(@Param('id') commentId: string, @Req() req: any) {
    await this.packsService.deleteComment(commentId, req.user.id);
  }
}
