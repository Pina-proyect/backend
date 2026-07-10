import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  Matches,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El slug no puede estar vacío' })
  @Matches(/^[a-zA-Z0-9-ñÑ]+$/, {
    message:
      'El slug solo puede contener letras, números, guiones y la letra ñ',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  profileImageBase64?: string;

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
  @IsBoolean()
  instagram?: boolean;

  @IsOptional()
  @IsBoolean()
  tiktok?: boolean;

  @IsOptional()
  @IsBoolean()
  youtube?: boolean;

  @IsOptional()
  @IsString()
  mpAccessToken?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pinaPrice?: number;

  @IsOptional()
  @IsString()
  donationGoalTitle?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  donationGoalAmount?: number;

  @IsOptional()
  @IsString()
  gender?: string;
}
