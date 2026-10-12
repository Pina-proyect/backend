import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cambio de estado administrativo de un retiro (v1.27, REQ-WD-4).
 * La evidencia es obligatoria en `paid` y `rejected` (se valida en el servicio).
 */
export class UpdateWithdrawalStatusDto {
  @IsIn(['approved', 'paid', 'rejected'], { message: 'status inválido' })
  status!: string;

  @IsOptional()
  @IsString({ message: 'evidence debe ser un texto' })
  @MaxLength(500, { message: 'evidence no puede superar los 500 caracteres' })
  evidence?: string;
}
