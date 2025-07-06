import { IsDateString, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateCreatorDto {
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  nationalId: string;

  @IsDateString()
  birthDate: string;

  @IsNotEmpty()
  idPhoto: string;

  @IsNotEmpty()
  selfie: string;
}
