import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for transcription operations
 */
export class TranscriptionResponseDto {
  @ApiProperty({
    description: 'The transcribed text from the audio file',
    example: 'This is a sample transcription of the audio file.',
    type: String,
  })
  public text!: string;

  @ApiProperty({
    description: 'The provider used for transcription',
    example: 'assemblyai',
    type: String,
  })
  public provider!: string;

  @ApiProperty({
    description: 'Unique request ID from the provider',
    example: 'abc123-def456-ghi789',
    type: String,
  })
  public requestId!: string;

  @ApiPropertyOptional({
    description: 'Duration of the audio file in seconds',
    example: 123.45,
    type: Number,
  })
  public durationSec?: number;

  @ApiPropertyOptional({
    description: 'Detected language code (e.g., en, ru, es)',
    example: 'en',
    type: String,
  })
  public language?: string;

  @ApiPropertyOptional({
    description: 'Average confidence score of the transcription (0-1)',
    example: 0.95,
    type: Number,
    minimum: 0,
    maximum: 1,
  })
  public confidenceAvg?: number;

  @ApiPropertyOptional({
    description: 'Number of words in the transcription',
    example: 42,
    type: Number,
  })
  public wordsCount?: number;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 5432,
    type: Number,
  })
  public processingMs!: number;

  @ApiProperty({
    description: 'Whether timestamps were requested for this transcription',
    example: false,
    type: Boolean,
  })
  public timestampsEnabled!: boolean;
}
