import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialLinkDto } from './social-link.dto';

export enum AiLanguage {
  es = 'es',
  en = 'en',
  pt = 'pt',
}

export class AnalyzeProfileDto {
  @IsBoolean({
    message: 'Debes aceptar el consentimiento para el análisis con IA',
  })
  consent: boolean;

  @IsOptional()
  @IsArray({ message: 'Las redes sociales deben ser una lista' })
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  @ArrayMaxSize(3, { message: 'Máximo 3 redes sociales' })
  socialLinks?: SocialLinkDto[];

  @IsOptional()
  @IsString({ message: 'El país debe ser un texto' })
  @MaxLength(60, { message: 'El país no puede superar 60 caracteres' })
  country?: string;

  @IsOptional()
  @IsString({ message: 'El nicho debe ser un texto' })
  @MaxLength(60, { message: 'El nicho no puede superar 60 caracteres' })
  niche?: string;

  @IsOptional()
  @IsString({ message: 'La bio debe ser un texto' })
  @MaxLength(255, { message: 'La bio no puede superar 255 caracteres' })
  bio?: string;

  @IsOptional()
  @IsEnum(AiLanguage, { message: 'El idioma debe ser es, en o pt' })
  language?: AiLanguage;
}

export class OnboardingIdeasDto {
  @IsEnum(['B', 'C'] as const, { message: 'El caso debe ser B o C' })
  case: 'B' | 'C';

  @IsString({ message: 'El índice de paso debe ser un número' })
  stepIndex: string;

  @IsOptional()
  @IsArray({ message: 'Las respuestas deben ser una lista' })
  @IsString({ each: true, message: 'Cada respuesta debe ser un texto' })
  answers?: string[];

  @IsOptional()
  @IsString({ message: 'El contexto base debe ser un texto' })
  baseContext?: string;
}
