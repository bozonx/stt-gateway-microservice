import { Body, Controller, Post, HttpCode, HttpStatus, Inject, Req } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import type { FastifyRequest } from 'fastify'
import { TranscribeFileDto } from '../../common/dto/transcribe-file.dto.js'
import { TranscriptionResponseDto } from '../../common/dto/transcription-response.dto.js'
import { TranscriptionService } from './transcription.service.js'

@Controller()
export class TranscriptionController {
  constructor(
    private readonly service: TranscriptionService,
    @Inject(PinoLogger) private readonly logger: PinoLogger
  ) {
    logger.setContext(TranscriptionController.name)
  }

  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  public async transcribe(
    @Req() req: FastifyRequest,
    @Body() dto: TranscribeFileDto
  ): Promise<TranscriptionResponseDto> {
    this.logger.info(`Received transcription request for URL: ${dto.audioUrl}`)
    const abortController = new AbortController()

    const onClose = () => {
      if (!abortController.signal.aborted) abortController.abort()
    }

    req.raw.once('close', onClose)
    req.raw.once('aborted', onClose)

    try {
      const result = await this.service.transcribeByUrl({
        ...dto,
        signal: abortController.signal,
      })
      this.logger.info(
        `Transcription request completed. Provider: ${result.provider}, Processing time: ${result.processingMs}ms`
      )
      return result
    } finally {
      req.raw.off('close', onClose)
      req.raw.off('aborted', onClose)
    }
  }
}
