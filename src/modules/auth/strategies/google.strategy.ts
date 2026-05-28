import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '@nestjs/config';

/**
 * GoogleStrategy
 * Encapsula la estrategia de Passport para manejar el flujo OAuth de Google.
 * Al validar el perfil, delega en AuthService la lógica de upsert del usuario.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'DUMMY_GOOGLE_CLIENT_ID';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || 'DUMMY_GOOGLE_CLIENT_SECRET';
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost/dummy-callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });

    this.logger.log('GoogleStrategy successfully initialized.');
  }

  /**
   * validate
   * Método invocado por Passport tras el callback de Google.
   * Debe invocar al callback `done` con el usuario (Creator) o error.
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    if (!emails || !emails[0]) {
      return done(new Error('No se pudo obtener el email de Google'), false);
    }

    const userData = {
      provider: 'google' as const,
      providerId: id,
      email: emails[0].value,
      fullName: `${name?.givenName ?? ''} ${name?.familyName ?? ''}`.trim(),
      photoPath: photos && photos[0] ? photos[0].value : null,
    };

    try {
      const user =
        await this.authService.validateOrCreateProviderUser(userData);
      // adjunta el usuario a req.user
      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
