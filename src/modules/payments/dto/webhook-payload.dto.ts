import { IsOptional, IsString } from 'class-validator';

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
  live_mode?: any;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  user_id?: any;
}
