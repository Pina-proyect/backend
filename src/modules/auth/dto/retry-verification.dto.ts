import { IsNotEmpty, IsUUID, IsUrl } from 'class-validator';

export class RetryVerificationDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUrl()
  @IsNotEmpty()
  selfiePath: string;

  @IsUrl()
  @IsNotEmpty()
  photoPath: string;
}
