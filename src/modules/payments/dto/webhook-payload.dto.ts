import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class WebhookDataDto {
  @IsOptional()
  id?: any;
}

export class WebhookPayloadDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  api_version?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookDataDto)
  data?: WebhookDataDto;

  @IsOptional()
  @IsString()
  date_created?: string;

  @IsOptional()
  id?: any;

  @IsOptional()
  live_mode?: any;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  user_id?: any;
}
