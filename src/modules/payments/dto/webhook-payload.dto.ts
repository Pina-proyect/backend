import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

export class WebhookPayloadDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  api_version?: string;

  @IsOptional()
  data?: {
    id?: string;
  };

  @IsOptional()
  @IsString()
  date_created?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsBoolean()
  live_mode?: boolean;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  user_id?: number;
}
