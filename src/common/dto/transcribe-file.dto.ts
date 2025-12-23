import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, Matches, Min } from 'class-validator';

export class TranscribeFileDto {
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'audioUrl must be a valid URL' })
  @Matches(/^https?:\/\//i, { message: 'audioUrl must start with http or https' })
  public readonly audioUrl!: string;

  @IsOptional()
  @IsString()
  public readonly provider?: string;

  @IsOptional()
  @IsBoolean()
  public readonly restorePunctuation?: boolean;

  /** Explicit source language code (e.g., 'en', 'ru') */
  @IsOptional()
  @IsString()
  public readonly language?: string;

  @IsOptional()
  @IsBoolean()
  public readonly formatText?: boolean;

  @IsOptional()
  @IsString()
  public readonly apiKey?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  public readonly maxWaitMinutes?: number;
}
