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
 * Schema for raw streaming transcription request query parameters.
 * All values come from the query string and therefore start as strings.
 */
export const transcribeStreamQuerySchema = z.object({
  provider: z.string().optional(),
  language: z.string().optional(),
  filename: z.string().min(1).optional(),
  restorePunctuation: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  formatText: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  includeWords: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  apiKey: z.string().optional(),
  maxWaitMinutes: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 1), {
      message: 'maxWaitMinutes must be a number >= 1',
    }),
  models: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined)),
})

export type TranscribeJsonRequest = z.infer<typeof transcribeJsonSchema>
export type TranscribeStreamQuery = z.infer<typeof transcribeStreamQuerySchema>
