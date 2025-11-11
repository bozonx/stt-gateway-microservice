import { Body, Controller, Post, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { TranscribeFileDto } from '@common/dto/transcribe-file.dto';
import { TranscriptionResponseDto } from '@common/dto/transcription-response.dto';
import { TranscriptionService } from './transcription.service';

@Controller('transcriptions')
export class TranscriptionController {
  constructor(
    private readonly service: TranscriptionService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    logger.setContext(TranscriptionController.name);
  }

  @Post('file')
  @HttpCode(HttpStatus.OK)
  public async transcribe(@Body() dto: TranscribeFileDto): Promise<TranscriptionResponseDto> {
    const host = (() => {
      try {
        return new URL(dto.audioUrl).hostname;
      } catch {
        return undefined;
      }
    })();
    this.logger.info(host ? `Transcription request received for host: ${host}` : 'Transcription request received');
    const result = await this.service.transcribeByUrl(dto);
    this.logger.info(
      `Transcription request completed. Provider: ${result.provider}, Processing time: ${result.processingMs}ms`,
    );
    return result;
  }
}
