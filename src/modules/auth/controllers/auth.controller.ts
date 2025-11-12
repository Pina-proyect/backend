import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import type { CookieOptions } from 'express';
import type { Creator } from '@prisma/client';
import { AuthService } from '../services/auth.service';
import { LoginCreatorDto } from '../dto/login-creator.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

/**
 * AuthController
 * Controlador responsable de exponer endpoints de autenticación
 * tanto convencional (email/password) como OAuth (Google).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Nombre del cookie para el refresh token
  private readonly REFRESH_COOKIE = 'refresh_token';
  // Opciones comunes para el cookie de refresh (HttpOnly)
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }

  // --- Endpoint de Login Convencional ---
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginCreatorDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    // Valida credenciales
    const tokens = await this.authService.login(loginDto);
    // Envía el refresh token en cookie HttpOnly
    res.cookie(this.REFRESH_COOKIE, tokens.refreshToken, this.cookieOptions());
    // Retorna el access token en el body
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // --- ENDPOINTS DE GOOGLE OAUTH ---

  /**
   * 1. Inicio de flujo OAuth: redirige a Google
   * El frontend puede enlazar a /api/pina/auth/google
   */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() _req: any) {
    // Passport maneja la redirección hacia Google automáticamente.
  }

  /**
   * 2. Callback de Google: crea/valida el usuario y emite JWT
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    // req.user ha sido adjuntado por GoogleStrategy.validate()
    const creator = req.user as Creator;

    // Generamos tokens JWT para el usuario
    const tokens = this.authService.generateTokens(creator);

    // Seteamos refresh token en cookie HttpOnly
    res.cookie(this.REFRESH_COOKIE, tokens.refreshToken, this.cookieOptions());
    // Redirigimos al frontend con el access token únicamente
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}`);
  }

  // --- ENDPOINTS DE REFRESH Y LOGOUT ---

  /**
   * Refresca tokens utilizando el refresh token del cliente.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
  ): Promise<LoginResponseDto> {
    const tokenFromCookie = req.cookies?.[this.REFRESH_COOKIE];
    const effectiveDto: RefreshTokenDto = {
      refreshToken: tokenFromCookie ?? dto?.refreshToken,
    };
    return this.authService.refreshTokens(effectiveDto);
  }

  /**
   * Logout: invalida refresh tokens incrementando tokenVersion en DB.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Body() dto: RefreshTokenDto): Promise<void> {
    const tokenFromCookie = req.cookies?.[this.REFRESH_COOKIE];
    const effectiveDto: RefreshTokenDto = {
      refreshToken: tokenFromCookie ?? dto?.refreshToken,
    };
    await this.authService.logout(effectiveDto);
  }
}