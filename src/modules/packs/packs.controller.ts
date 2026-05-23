import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  HttpStatus,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PacksService } from './packs.service';
import { PackAccessGuard } from './guards/pack-access.guard';

@Controller('packs')
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async createPack(
    @Req() req: any,
    @Body()
    data: {
      title: string;
      description?: string;
      price: number;
      categoryId: string;
      mediaIds: string[];
    },
  ) {
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
    return this.packsService.grantAccess(req.user.id, packId);
  }
}
