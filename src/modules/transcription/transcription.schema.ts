import { z } from 'zod'

/**
 * Schema for JSON-based transcription request
 */
export const transcribeJsonSchema = z.object({
  audioUrl: z
    .string()
    .min(1, 'audioUrl is required')
    .url('audioUrl must be a valid URL')
    .regex(/^https?:\/\//i, 'audioUrl must start with http or https'),
  provider: z.string().optional(),
  language: z.string().optional(),
  restorePunctuation: z.boolean().optional(),
  formatText: z.boolean().optional(),
  includeWords: z.boolean().optional(),
  apiKey: z.string().optional(),
  maxWaitMinutes: z.number().int().min(1).optional(),
  models: z.array(z.string()).optional(),
})

/**
 * Schema for raw streaming transcription request headers.
 * All values come from HTTP headers and therefore start as strings.
 */
export const transcribeStreamHeadersSchema = z.object({
  'x-stt-provider': z.string().optional(),
  'x-stt-language': z.string().optional(),
  'x-file-name': z.string().min(1).optional(),
  'x-stt-restore-punctuation': z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  'x-stt-format-text': z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  'x-stt-include-words': z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  'x-stt-api-key': z.string().optional(),
  'x-stt-max-wait-minutes': z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 1), {
      message: 'x-stt-max-wait-minutes must be a number >= 1',
    }),
  'x-stt-models': z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined)),
})

export type TranscribeJsonRequest = z.infer<typeof transcribeJsonSchema>
export type TranscribeStreamHeaders = z.infer<typeof transcribeStreamHeadersSchema>
