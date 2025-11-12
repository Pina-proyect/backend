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
import { Response } from 'express';
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

  // --- Endpoint de Login Convencional ---
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginCreatorDto): Promise<LoginResponseDto> {
    // Valida credenciales y retorna tokens
    return this.authService.login(loginDto);
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

    // Redirigimos al frontend con los tokens (Zustand los debe almacenar)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }

  // --- ENDPOINTS DE REFRESH Y LOGOUT ---

  /**
   * Refresca tokens utilizando el refresh token del cliente.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponseDto> {
    return this.authService.refreshTokens(dto);
  }

  /**
   * Logout: invalida refresh tokens incrementando tokenVersion en DB.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto);
  }
}