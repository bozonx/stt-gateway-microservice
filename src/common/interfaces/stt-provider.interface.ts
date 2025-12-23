export interface TranscriptionRequestByUrl {
  audioUrl: string
  apiKey?: string
  signal?: AbortSignal
  // If true/false is provided, provider should explicitly control punctuation restoration.
  // When undefined, provider defaults apply (e.g., true for AssemblyAI).
  restorePunctuation?: boolean
  // Explicit source language code (e.g., 'en', 'ru', 'en-US') when supported
  language?: string
  // Format text output (e.g., punctuation, capitalization)
  formatText?: boolean
  // Total synchronization timeout in minutes
  maxWaitMinutes?: number
  // Maximum number of retries for submission
  maxRetries?: number
  // Delay between retries in milliseconds
  retryDelayMs?: number
}

export interface WordTiming {
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  text: string
  requestId: string
  durationSec?: number
  language?: string // Detected or specified source language
  confidenceAvg?: number
  words?: WordTiming[]
  // Whether punctuation has been restored/kept by provider
  punctuationRestored?: boolean
  // Raw provider payload
  raw: unknown
}

export interface SttProvider {
  submitAndWaitByUrl(params: TranscriptionRequestByUrl): Promise<TranscriptionResult>
}
