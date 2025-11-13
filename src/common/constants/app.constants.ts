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
} as const

/**
 * Service metadata
 */
export const SERVICE_METADATA = {
  NAME: 'micro-stt',
  DESCRIPTION: 'Speech-to-Text microservice',
} as const

/**
 * AssemblyAI speech models
 */
export const ASSEMBLYAI_SPEECH_MODELS = ['best', 'universal', 'slam-1'] as const
