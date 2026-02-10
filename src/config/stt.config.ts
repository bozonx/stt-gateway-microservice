/**
 * Platform-agnostic STT configuration
 * Works with process.env (Node.js) and env bindings (Cloudflare Workers)
 */

export interface SttConfig {
  defaultProvider: string
  allowedProviders?: string[]
  tmpFilesBaseUrl: string
  tmpFilesDefaultTtlMins: number
  maxFileMb: number
  providerApiTimeoutSeconds: number
  pollIntervalMs: number
  defaultMaxWaitMinutes: number
  maxRetries: number
  retryDelayMs: number
  assemblyAiApiKey?: string
}

function parseIntChecked(
  value: string | undefined,
  fallback: number,
  name: string,
  min: number,
  max: number
): number {
  const num = parseInt(value ?? String(fallback), 10)
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`STT config validation error: ${name} must be between ${min} and ${max}`)
  }
  return num
}

export function loadSttConfig(env: Record<string, string | undefined>): SttConfig {
  const allowedProviders = (() => {
    const raw = env.ALLOWED_PROVIDERS
    if (!raw || raw.trim() === '') return undefined
    const list = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    return list.length ? list : undefined
  })()

  return {
    defaultProvider: env.DEFAULT_PROVIDER ?? 'assemblyai',
    allowedProviders,
    maxFileMb: parseIntChecked(env.MAX_FILE_SIZE_MB, 100, 'MAX_FILE_SIZE_MB', 1, 1000),
    providerApiTimeoutSeconds: parseIntChecked(
      env.PROVIDER_API_TIMEOUT_SECONDS,
      15,
      'PROVIDER_API_TIMEOUT_SECONDS',
      1,
      300
    ),
    pollIntervalMs: parseIntChecked(env.POLL_INTERVAL_MS, 1500, 'POLL_INTERVAL_MS', 100, 10000),
    defaultMaxWaitMinutes: parseIntChecked(
      env.DEFAULT_MAX_WAIT_MINUTES,
      3,
      'DEFAULT_MAX_WAIT_MINUTES',
      1,
      60
    ),
    maxRetries: parseIntChecked(env.MAX_RETRIES, 3, 'MAX_RETRIES', 0, 10),
    retryDelayMs: parseIntChecked(env.RETRY_DELAY_MS, 1500, 'RETRY_DELAY_MS', 0, 10000),
    assemblyAiApiKey: env.ASSEMBLYAI_API_KEY || undefined,
    tmpFilesBaseUrl: env.TMP_FILES_BASE_URL ?? 'http://tmp-files-microservice:8080/api/v1',
    tmpFilesDefaultTtlMins: parseIntChecked(
      env.TMP_FILES_DEFAULT_TTL_MINS,
      30,
      'TMP_FILES_DEFAULT_TTL_MINS',
      1,
      44640
    ),
  }
}
