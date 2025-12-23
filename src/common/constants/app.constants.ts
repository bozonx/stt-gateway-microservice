/**
 * Application-wide constants
 */

/**
 * AssemblyAI API endpoints
 */
export const ASSEMBLYAI_API = {
  BASE_URL: 'https://api.assemblyai.com/v2',
  TRANSCRIPTS_ENDPOINT: '/transcript',
} as const

/**
 * HTTP timeout defaults (in milliseconds)
 */
export const HTTP_TIMEOUTS = {
  DEFAULT_REQUEST: 15000,
  HEAD_REQUEST: 5000,
  RETRY_JITTER_PERCENT: 20, // +- 20%
} as const

/**
 * Retry and polling behavior constants
 */
export const RETRY_BEHAVIOR = {
  // Maximum consecutive polling errors before failing
  MAX_CONSECUTIVE_POLL_ERRORS: 5,
  // Multiplier for exponential backoff in polling after errors
  POLL_BACKOFF_MULTIPLIER: 1.5,
  // Maximum polling interval in milliseconds (10 seconds)
  MAX_POLL_INTERVAL_MS: 10000,
} as const

/**
 * Graceful shutdown timeout (in milliseconds)
 * Server will wait this long for active requests to complete before forcing shutdown
 */
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 25000

/**
 * Service metadata
 */
export const SERVICE_METADATA = {
  NAME: 'micro-stt',
  DESCRIPTION: 'Speech-to-Text microservice',
} as const
