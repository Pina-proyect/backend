import {
  IsBoolean,
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

  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  @IsDateString()
  birthDate: string;

  @IsOptional()
  @IsBoolean()
  acknowledgedAge?: boolean;

  @IsOptional()
  @IsString()
  photoPath?: string;

  @IsOptional()
  @IsString()
  selfiePath?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  role?: string;
}
