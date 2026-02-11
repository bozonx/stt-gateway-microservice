export interface TranscriptionRequestByUrl {
  audioUrl: string
  apiKey?: string
  signal?: AbortSignal
  // If true/false is provided, provider should explicitly control punctuation restoration.
  // When undefined, provider defaults apply (e.g., true for AssemblyAI).
  restorePunctuation?: boolean
  // Source language code
  language?: string
  // Models to use for transcription (e.g., ['universal-3-pro', 'universal-2'])
  models?: string[]
  // Format text output (e.g., punctuation, capitalization)
  formatText?: boolean
  // If true, include word-level timings in the result when supported by the provider.
  includeWords?: boolean
  // Total synchronization timeout in minutes (optional override)
  maxWaitMinutes?: number
}

export interface SttProviderCapabilities {
  restorePunctuation: boolean
  formatText: boolean
  models: boolean
  wordTimings: boolean
}

export interface WordTiming {
  start: number
  end: number
  text: string
  confidence?: number
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
  capabilities: SttProviderCapabilities
  submitAndWaitByUrl(params: TranscriptionRequestByUrl): Promise<TranscriptionResult>
}
