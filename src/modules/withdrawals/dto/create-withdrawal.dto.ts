import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Solicitud de retiro de la creadora (v1.27, REQ-WD-2).
 * `amount` se expresa en ARS y el servicio lo convierte a centavos (Int).
 */
export class CreateWithdrawalDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount debe ser un número (ARS)' },
  )
  @IsPositive({ message: 'amount debe ser mayor a 0' })
  amount!: number;

  @IsString({ message: 'clientRequestId debe ser un texto' })
  @IsNotEmpty({ message: 'clientRequestId es obligatorio' })
  @MaxLength(100, {
    message: 'clientRequestId no puede superar los 100 caracteres',
  })
  clientRequestId!: string;

  @IsOptional()
  @IsString({ message: 'destinationPlatform debe ser un texto' })
  destinationPlatform?: string;

  @IsOptional()
  @IsString({ message: 'destinationReference debe ser un texto' })
  @MaxLength(200, {
    message: 'destinationReference no puede superar los 200 caracteres',
  })
  destinationReference?: string;
}
