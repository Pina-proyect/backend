import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { IsMediaVisibility, MediaVisibility } from './media-visibility';

export class CreatePackDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsUUID()
  categoryId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  mediaIds: string[];

  // Opcional y aditivo: visibilidad por media (`preview` público / `exclusive`).
  // No altera `mediaIds`; el service valida la pertenencia de cada media.
  @IsOptional()
  @IsMediaVisibility()
  mediaVisibility?: Record<string, MediaVisibility>;
}
