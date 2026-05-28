import { IsOptional, IsString, Matches, MaxLength, IsNotEmpty } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El slug no puede estar vacío' })
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'El slug solo puede contener letras, números y guiones',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'La biografía no puede exceder 255 caracteres',
  })
  bio?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  niche?: string;

  @IsOptional()
  instagram?: boolean;

  @IsOptional()
  tiktok?: boolean;

  @IsOptional()
  youtube?: boolean;

  @IsOptional()
  @IsString()
  mpAccessToken?: string;

  @IsOptional()
  pinaPrice?: number;

  @IsOptional()
  @IsString()
  donationGoalTitle?: string;

  @IsOptional()
  donationGoalAmount?: number;

  @IsOptional()
  @IsString()
  gender?: string;
}