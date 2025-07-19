import { IsDateString, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateCreatorDto {
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  nationalId: string;

  @IsDateString()
  birthDate: string; // validación básica

  @IsNotEmpty()
  photoPath: string; // será una URL a S3

  @IsNotEmpty()
  selfiePath: string; // será una URL a S3
}
