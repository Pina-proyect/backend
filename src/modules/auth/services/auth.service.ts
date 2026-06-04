import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Creator } from '@prisma/client';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { CreatorRepository } from '../repositories/creator.repository';
import { EmailService } from '../../email/email.service';
import { LoginCreatorDto } from '../dto/login-creator.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';

/**
 * AuthService
 * Responsable de validar o crear usuarios provenientes de proveedores OAuth (Google/Facebook).
 * Implementa la lógica de "buscar por proveedor" y, si no existe, asociar por email o crear.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * validateOrCreateProviderUser
   * - Busca un Creator por provider + providerId.
   * - Si existe, lo devuelve.
   * - Si no existe, intenta vincular por email; si hay coincidencia, actualiza campos de proveedor.
   * - Caso contrario, crea un nuevo Creator mínimo para onboarding.
   *
   * Nota: birthDate no está disponible desde Google; se establece un placeholder.
   * Luego deberá completarse durante el onboarding.
   */
  async validateOrCreateProviderUser(userData: {
    provider: string;
    providerId: string;
    email: string;
    fullName: string;
    photoPath?: string | null;
  }): Promise<Creator> {
    // 1. Buscar si el usuario ya existe por su Provider ID
    const user = await this.creatorRepository.findByProvider(
      userData.provider,
      userData.providerId,
    );
    if (user) return user;

    // 2. Si no existe por Provider ID, ¿quizás ya existe por email?
    const userByEmail = await this.creatorRepository.findByEmail(
      userData.email,
    );
    if (userByEmail) {
      // MVP: no vinculamos automáticamente. Forzamos login convencional.
      throw new UnauthorizedException(
        'Ya existe una cuenta con este email. Por favor, inicia sesión de forma convencional.',
      );
    }

    // 3. Si no existe, lo creamos sin datos sensibles/obligatorios de onboarding
    const newUser = await this.creatorRepository.create({
      email: userData.email,
      fullName: userData.fullName,
      provider: userData.provider,
      providerId: userData.providerId,
      // Placeholder: Google no provee birthDate
      birthDate: new Date(),
      // Campos opcionales que quedarán para completar en onboarding
      password: null,
      phone: null,
      selfiePath: null,
      photoPath: userData.photoPath || null,
    });

    return newUser;
  }

  /**
   * Genera tokens JWT (access y refresh placeholder) para un Creator validado.
   */
  generateTokens(user: Creator): { accessToken: string; refreshToken: string } {
    // Payload del access token: mínimo necesario (no incluir datos sensibles)
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    // Payload del refresh token: incluir tokenVersion para invalidación en logout
    const refreshPayload = { sub: user.id, tokenVersion: user.tokenVersion };
    // Tipar correctamente expiresIn: acepta número (segundos) o string (e.g., '7d')
    const raw = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    const expiresIn: string | number = /^\d+$/.test(raw) ? Number(raw) : raw;
    const expiresInOpt: JwtSignOptions['expiresIn'] =
      typeof expiresIn === 'number'
        ? expiresIn
        : (expiresIn as unknown as JwtSignOptions['expiresIn']);
    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: expiresInOpt,
    });
    return { accessToken, refreshToken };
  }

  /**
   * login
   * Autenticación convencional por email y password.
   * Nota: En producción, la password debe estar hasheada (bcrypt/argon2).
   */
  async login(loginDto: LoginCreatorDto): Promise<LoginResponseDto> {
    const user = await this.creatorRepository.findByEmail(loginDto.email);
    // Validación: usuario existe y password hasheada presente
    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Comparación segura con bcrypt: NO comparar en texto plano
    const isValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'EMAIL_NOT_VERIFIED',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const tokens = this.generateTokens(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * refreshTokens
   * Verifica el refresh token y emite un nuevo access token.
   * Implementa invalidación basada en tokenVersion almacenada en DB.
   */
  async refreshTokens(dto: RefreshTokenDto): Promise<LoginResponseDto> {
    try {
      const decoded = this.jwtService.verify(dto.refreshToken);
      const userId = decoded.sub as string;
      const tokenVersion = decoded.tokenVersion as number;
      const user = await this.creatorRepository.findById(userId);
      if (!user || user.tokenVersion !== tokenVersion) {
        throw new UnauthorizedException('Refresh token inválido');
      }
      const tokens = this.generateTokens(user);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  /**
   * logout
   * Invalida todos los refresh tokens vigentes incrementando tokenVersion.
   */
  async logout(dto: RefreshTokenDto): Promise<void> {
    try {
      const decoded = this.jwtService.verify(dto.refreshToken);
      const userId = decoded.sub as string;
      await this.creatorRepository.incrementTokenVersion(userId);
      // No retornamos contenido; el cliente elimina sus tokens.
    } catch {
      // Para evitar enumeración de usuarios, respondemos 401 si falla.
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const creator = await this.creatorRepository.findByEmail(email);
    if (!creator || creator.emailVerified) {
      return { message: 'Si el email existe, recibirás un enlace de verificación.' };
    }

    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.creatorRepository.update(creator.id, {
      verificationToken,
      verificationTokenExpires,
    } as any);

    await this.emailService.sendVerificationEmail(creator.email, verificationToken);

    return { message: 'Si el email existe, recibirás un enlace de verificación.' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const creator = await this.creatorRepository.findByEmail(email);
    if (!creator) {
      return { message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' };
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    await this.creatorRepository.update(creator.id, {
      resetToken,
      resetTokenExpires,
    } as any);

    await this.emailService.sendPasswordResetEmail(creator.email, resetToken);

    return { message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const creator = await this.creatorRepository.findByResetToken(token);
    if (!creator) {
      throw new BadRequestException('Token de restablecimiento inválido');
    }

    if (creator.resetTokenExpires && creator.resetTokenExpires < new Date()) {
      throw new BadRequestException('Token de restablecimiento expirado');
    }

    const saltRoundsRaw = process.env.BCRYPT_SALT_ROUNDS || '10';
    const saltRounds = Number(saltRoundsRaw);
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.creatorRepository.update(creator.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpires: null,
      tokenVersion: { increment: 1 },
    } as any);

    return { message: 'Contraseña restablecida correctamente.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const creator = await this.creatorRepository.findByVerificationToken(token);
    if (!creator) {
      throw new BadRequestException('Token de verificación inválido');
    }

    if (creator.verificationTokenExpires && creator.verificationTokenExpires < new Date()) {
      throw new BadRequestException('Token de verificación expirado');
    }

    await this.creatorRepository.update(creator.id, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
    } as any);

    return { message: 'Email verificado correctamente' };
  }

  /**
   * updateProfile
   * Actualiza el perfil del usuario autenticado (slug, bio, etc.)
   */
  async updateProfile(userId: string, updateData: UpdateProfileDto): Promise<Creator> {
    // Verificar que el usuario existe
    const existingUser = await this.creatorRepository.findById(userId);
    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se está actualizando el slug, verificar que no esté en uso
    if (updateData.slug) {
      const userWithSameSlug = await this.creatorRepository.findBySlug(updateData.slug);
      if (userWithSameSlug && userWithSameSlug.id !== userId) {
        throw new UnauthorizedException('El slug ya está en uso');
      }
    }

    // Actualizar el perfil
    return this.creatorRepository.update(userId, {
      slug: updateData.slug,
      bio: updateData.bio,
    });
  }
}
