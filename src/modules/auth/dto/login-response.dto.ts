/**
 * LoginResponseDto
 * Respuesta estándar al login: tokens de acceso y refresh.
 */
export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
}
