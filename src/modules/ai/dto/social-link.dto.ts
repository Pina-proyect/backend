import {
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SocialPlatform {
  instagram = 'instagram',
  tiktok = 'tiktok',
  youtube = 'youtube',
}

export class SocialLinkDto {
  @IsEnum(SocialPlatform, {
    message: 'La plataforma debe ser instagram, tiktok o youtube',
  })
  platform: SocialPlatform;

  @IsString({ message: 'La URL debe ser un texto' })
  @IsUrl({ require_protocol: false }, { message: 'La URL no es válida' })
  @Matches(/(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)/i, {
    message: 'La URL debe pertenecer a Instagram, TikTok o YouTube',
  })
  url: string;

  @IsOptional()
  @IsInt({ message: 'La cantidad de seguidores debe ser un número entero' })
  @Min(0, { message: 'La cantidad de seguidores no puede ser negativa' })
  followers?: number;
}

export class SocialLinksDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  @ArrayMaxSize(3, { message: 'Máximo 3 redes sociales' })
  socialLinks?: SocialLinkDto[];
}
