/**
 * LoginResponseDto
 * Respuesta estándar al login: tokens de acceso, refresh y datos del usuario.
 */
export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: Record<string, unknown>;
}
