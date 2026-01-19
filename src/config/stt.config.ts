import { registerAs } from '@nestjs/config'
import { IsString, IsArray, IsInt, IsOptional, Min, Max, validateSync } from 'class-validator'
import { plainToClass } from 'class-transformer'

export class SttConfig {
  @IsString()
  public defaultProvider!: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public allowedProviders?: string[]

  @IsString()
  public tmpFilesBaseUrl!: string

  @IsInt()
  @Min(1)
  @Max(44640)
  public tmpFilesDefaultTtlMins!: number

  @IsInt()
  @Min(1)
  @Max(1000)
  public maxFileMb!: number

  @IsInt()
  @Min(1)
  @Max(300)
  public providerApiTimeoutSeconds!: number

  @IsInt()
  @Min(100)
  @Max(10000)
  public pollIntervalMs!: number

  @IsInt()
  @Min(1)
  @Max(60)
  public defaultMaxWaitMinutes!: number

  @IsInt()
  @Min(0)
  @Max(10)
  public maxRetries!: number

  @IsInt()
  @Min(0)
  @Max(10000)
  public retryDelayMs!: number

  @IsOptional()
  @IsString()
  public assemblyAiApiKey?: string
}

export default registerAs('stt', (): SttConfig => {
  const config = plainToClass(SttConfig, {
    defaultProvider: process.env.DEFAULT_PROVIDER ?? 'assemblyai',
    allowedProviders: (() => {
      const raw = process.env.ALLOWED_PROVIDERS
      if (!raw || raw.trim() === '') return undefined
      const list = raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      return list.length ? list : undefined
    })(),
    maxFileMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '100', 10),
    providerApiTimeoutSeconds: parseInt(process.env.PROVIDER_API_TIMEOUT_SECONDS ?? '15', 10),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '1500', 10),
    defaultMaxWaitMinutes: parseInt(process.env.DEFAULT_MAX_WAIT_MINUTES ?? '3', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES ?? '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS ?? '1500', 10),
    assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY,
    tmpFilesBaseUrl:
      process.env.TMP_FILES_BASE_URL ?? 'http://tmp-files-microservice:8080/api/v1',
    tmpFilesDefaultTtlMins: parseInt(process.env.TMP_FILES_DEFAULT_TTL_MINS ?? '30', 10),
  })

  const errors = validateSync(config, {
    skipMissingProperties: false,
  })

  if (errors.length > 0) {
    const errorMessages = errors.map((err) => Object.values(err.constraints ?? {}).join(', '))
    throw new Error(`STT config validation error: ${errorMessages.join('; ')}`)
  }

  return config
})
