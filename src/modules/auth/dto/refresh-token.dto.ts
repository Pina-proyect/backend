import { IsString } from 'class-validator';

/**
 * RefreshTokenDto
 * DTO para operaciones que requieren un refresh token.
 */
export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}