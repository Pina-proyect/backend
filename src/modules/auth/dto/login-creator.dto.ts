import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * LoginCreatorDto
 * DTO para login convencional con email y password.
 */
export class LoginCreatorDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}