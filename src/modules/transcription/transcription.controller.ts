import { Body, Controller, Post, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { TranscribeFileDto } from '@common/dto/transcribe-file.dto';
import { TranscriptionResponseDto } from '@common/dto/transcription-response.dto';
import { TranscriptionService } from './transcription.service';

@Controller()
export class TranscriptionController {
  constructor(
    private readonly service: TranscriptionService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    logger.setContext(TranscriptionController.name);
  }

  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  public async transcribe(@Body() dto: TranscribeFileDto): Promise<TranscriptionResponseDto> {
    this.logger.info(`Received transcription request for URL: ${dto.audioUrl}`);
    const result = await this.service.transcribeByUrl(dto);
    this.logger.info(
      `Transcription request completed. Provider: ${result.provider}, Processing time: ${result.processingMs}ms`,
    );
    return result;
  }
}
