import { registerAs } from '@nestjs/config';
import {
  IsString,
  IsArray,
  IsInt,
  IsOptional,
  Min,
  Max,
  validateSync,
} from 'class-validator';
import { plainToClass } from 'class-transformer';

export class SttConfig {
  @IsString()
  public defaultProvider!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public allowedProviders?: string[];

  @IsInt()
  @Min(1)
  @Max(1000)
  public maxFileMb!: number;

  @IsInt()
  @Min(1)
  @Max(300)
  public requestTimeoutSeconds!: number;

  @IsInt()
  @Min(100)
  @Max(10000)
  public pollIntervalMs!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  public totalTimeoutMinutes!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  public maxRetries!: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  public retryDelayMs!: number;

  @IsOptional()
  @IsString()
  public assemblyAiApiKey?: string;
}

export default registerAs('stt', (): SttConfig => {
  const config = plainToClass(SttConfig, {
    defaultProvider: process.env.STT_DEFAULT_PROVIDER ?? 'assemblyai',
    allowedProviders: (() => {
      const raw = process.env.STT_ALLOWED_PROVIDERS;
      if (!raw || raw.trim() === '') return undefined;
      const list = raw
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      return list.length ? list : undefined;
    })(),
    maxFileMb: parseInt(process.env.STT_MAX_FILE_SIZE_MB ?? '100', 10),
    requestTimeoutSeconds: parseInt(process.env.STT_REQUEST_TIMEOUT_SECONDS ?? '15', 10),
    pollIntervalMs: parseInt(process.env.STT_POLL_INTERVAL_MS ?? '1500', 10),
    totalTimeoutMinutes: parseInt(process.env.STT_TOTAL_TIMEOUT_MINUTES ?? process.env.STT_MAX_SYNC_WAIT_MINUTES ?? '3', 10),
    maxRetries: parseInt(process.env.STT_MAX_RETRIES ?? '3', 10),
    retryDelayMs: parseInt(process.env.STT_RETRY_DELAY_MS ?? '1000', 10),
    assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY,
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`STT config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
