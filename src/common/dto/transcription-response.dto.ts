/**
 * Response DTO for transcription operations
 */
export class TranscriptionResponseDto {
  public text!: string

  public provider!: string

  public requestId!: string

  public durationSec?: number

  /** Detected or specified source language */
  public language?: string

  public confidenceAvg?: number

  public wordsCount?: number

  public processingMs!: number

  public punctuationRestored!: boolean

  public raw!: unknown
}
