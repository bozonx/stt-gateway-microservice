export interface TranscriptionRequestByUrl {
  audioUrl: string;
  apiKey?: string;
  // If true/false is provided, provider should explicitly control punctuation restoration.
  // When undefined, provider defaults apply (e.g., true for AssemblyAI).
  restorePunctuation?: boolean;
  // Request word-level timestamps when supported by provider
  timestamps?: boolean;
  // Explicit language code (e.g., 'en', 'ru', 'en-US') when supported
  language?: string;
  // Format text output (e.g., punctuation, capitalization)
  formatText?: boolean;
}

export interface WordTiming {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  requestId: string;
  durationSec?: number;
  language?: string;
  confidenceAvg?: number;
  words?: WordTiming[];
  // Whether punctuation has been restored/kept by provider
  punctuationRestored?: boolean;
  // Raw provider payload
  raw: unknown;
}

export interface SttProvider {
  submitAndWaitByUrl(params: TranscriptionRequestByUrl): Promise<TranscriptionResult>;
}
