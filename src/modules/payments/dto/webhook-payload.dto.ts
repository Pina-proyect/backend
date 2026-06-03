import { IsOptional, IsString } from 'class-validator';

export class WebhookPayloadDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  data?: {
    id?: string;
  };

  @IsOptional()
  @IsString()
  id?: string;
}
