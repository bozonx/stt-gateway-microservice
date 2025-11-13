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
 * AssemblyAI Universal model supported languages
 * https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages
 */
export const ASSEMBLYAI_UNIVERSAL_LANGUAGES = [
  // High accuracy (≤ 10% WER)
  'en', 'es', 'fr', 'de', 'id', 'it', 'ja', 'nl', 'pl', 'pt', 'ru', 'tr', 'uk', 'ca',
  // Good accuracy (>10% to ≤25% WER)
  'ar', 'az', 'bg', 'bs', 'zh', 'cs', 'da', 'el', 'et', 'fi', 'fil', 'gl', 'hi', 'hr', 'hu', 'ko', 'mk', 'ms', 'nb', 'ro', 'sk', 'sv', 'th', 'ur', 'vi',
  // Moderate accuracy (>25% to ≤50% WER)
  'af', 'be', 'cy', 'fa', 'he', 'hy', 'is', 'kk', 'lt', 'lv', 'mi', 'mr', 'sl', 'sw', 'ta',
  // Fair accuracy (>50% WER)
  'am', 'as', 'bn', 'gu', 'ha', 'jv', 'ka', 'km', 'kn', 'lb', 'ln', 'lo', 'ml', 'mn', 'mt', 'my', 'ne', 'oc', 'pa', 'ps', 'sd', 'sn', 'so', 'sr', 'te', 'tg', 'uz', 'yo',
] as const

/**
 * AssemblyAI speech models
 */
export const ASSEMBLYAI_SPEECH_MODELS = ['best', 'universal', 'slam-1'] as const
