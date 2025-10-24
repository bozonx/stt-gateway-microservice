import { IsBoolean, IsOptional, IsString, IsUrl, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TranscribeFileDto {
  @ApiProperty({
    description: 'URL of the audio file to transcribe. Must be publicly accessible via HTTP/HTTPS.',
    example: 'https://example.com/audio/sample.mp3',
    type: String,
  })
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'audioUrl must be a valid URL' })
  @Matches(/^https?:\/\//i, { message: 'audioUrl must start with http or https' })
  public readonly audioUrl!: string;

  @ApiPropertyOptional({
    description: 'Speech-to-text provider to use for transcription.',
    example: 'assemblyai',
  })
  @IsOptional()
  @IsString()
  public readonly provider?: string;

  @ApiPropertyOptional({
    description: 'Whether to include word-level timestamps in the transcription result.',
    type: Boolean,
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  public readonly timestamps?: boolean;

  @ApiPropertyOptional({
    description:
      'Custom API key for the transcription provider. If not provided, the service will use its configured key.',
    type: String,
    example: 'your-assemblyai-api-key',
  })
  @IsOptional()
  @IsString()
  public readonly apiKey?: string;
}
