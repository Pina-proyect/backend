import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CreatorRepository } from '../repositories/creator.repository';
import { CacheService } from '../../../common/cache/cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly cache: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: { sub: string }) {
    const { sub: userId } = payload;
    const cacheKey = `user:${userId}`;

    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const user = await this.creatorRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Token inválido o usuario no encontrado');
    }

    await this.cache.set(cacheKey, user, 300);
    return user;
  }
}
