import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { IsMediaVisibility, MediaVisibility } from './media-visibility';

/** Estados válidos de un ContentPack (enum de negocio). */
export const PACK_STATUSES = ['active', 'hidden', 'archived'] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

/**
 * DTO de PATCH /packs/:id. Todos los campos son opcionales: el service exige
 * que al menos uno esté presente (regla de negocio, no de forma).
 */
export class UpdatePackDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mediaIds?: string[];

  // Opcional y aditivo: visibilidad por media (`preview` / `exclusive`).
  @IsOptional()
  @IsMediaVisibility()
  mediaVisibility?: Record<string, MediaVisibility>;

  @IsOptional()
  @IsIn(PACK_STATUSES)
  status?: PackStatus;
}
