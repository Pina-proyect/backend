import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CreatorRepository } from '../repositories/creator.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly creatorRepository: CreatorRepository) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'DUMMY_JWT_SECRET',
    });
  }

  /**
   * validate
   * Se ejecuta automáticamente tras decodificar el JWT.
   * El payload contiene { email, sub }.
   */
  async validate(payload: any) {
    const { sub: userId } = payload;
    const user = await this.creatorRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Token inválido o usuario no encontrado');
    }
    // El objeto retornado aquí es el que se inyecta en req.user
    return user;
  }
}
