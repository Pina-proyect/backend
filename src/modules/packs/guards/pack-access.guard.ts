import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PacksService } from '../packs.service';

@Injectable()
export class PackAccessGuard implements CanActivate {
  constructor(private readonly packsService: PacksService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Debes iniciar sesión para acceder a este contenido.',
      );
    }

    const packId = request.params.id || request.params.packId;
    if (!packId) {
      throw new NotFoundException('ID del paquete no especificado en la ruta.');
    }

    try {
      // Verificar que el pack existe
      const pack = await this.packsService.getPackById(packId);
      if (!pack) {
        throw new NotFoundException('Paquete de contenido no encontrado.');
      }

      // Validar si el usuario logueado tiene acceso (es el dueño o compró el pack)
      const hasAccess = await this.packsService.hasAccess(user.id, packId);
      if (!hasAccess) {
        throw new ForbiddenException(
          'No tienes acceso a este paquete de contenido. Adquiérelo para desbloquearlo.',
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new ForbiddenException(
        'No tienes acceso a este paquete de contenido.',
      );
    }
  }
}
