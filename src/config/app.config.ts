import { registerAs } from '@nestjs/config';
import { IsInt, IsString, IsIn, Min, Max, IsArray, IsBoolean, validateSync } from 'class-validator';
import { plainToClass, Transform } from 'class-transformer';

export class AppConfig {
  @IsInt()
  @Min(1)
  @Max(65535)
  public port!: number;

  @IsString()
  public host!: string;

  @IsString()
  public apiBasePath!: string;

  @IsString()
  public apiVersion!: string;

  @IsIn(['development', 'production', 'test'])
  public nodeEnv!: string;

  // Allow only Pino log levels
  @IsIn(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
  public logLevel!: string;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  public authEnabled!: boolean;

  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map(token => token.trim())
        .filter(token => token.length > 0);
    }
    return value;
  })
  public authTokens!: string[];
}

export default registerAs('app', (): AppConfig => {
  const config = plainToClass(AppConfig, {
    port: parseInt(process.env.LISTEN_PORT ?? '80', 10),
    host: process.env.LISTEN_HOST ?? '0.0.0.0',
    apiBasePath: (process.env.API_BASE_PATH ?? 'api').replace(/^\/+|\/+$/g, ''),
    apiVersion: (process.env.API_VERSION ?? 'v1').replace(/^\/+|\/+$/g, ''),
    nodeEnv: process.env.NODE_ENV ?? 'production',
    logLevel: process.env.LOG_LEVEL ?? 'warn',
    authEnabled: process.env.AUTH_ENABLED ?? 'false',
    authTokens: process.env.AUTH_TOKENS ?? '',
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`App config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
