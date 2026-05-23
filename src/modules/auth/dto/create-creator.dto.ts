import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateCreatorDto {
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsDateString()
  birthDate: string; // validación básica

  @IsOptional()
  @IsString()
  photoPath?: string; // será una URL a S3

  @IsOptional()
  @IsString()
  selfiePath?: string; // será una URL a S3

  // Contraseña opcional para registro convencional.
  // Si está presente, se hasheará en el servicio antes de persistir.
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  role?: string;
}
