import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Inject,
  Req,
  BadRequestException,
} from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import type { FastifyRequest } from 'fastify'
import { TranscribeFileDto } from '../../common/dto/transcribe-file.dto.js'
import { TranscriptionResponseDto } from '../../common/dto/transcription-response.dto.js'
import { TranscriptionService } from './transcription.service.js'
import { TmpFilesService } from './tmp-files.service.js'

@Controller()
export class TranscriptionController {
  constructor(
    private readonly service: TranscriptionService,
    private readonly tmpFiles: TmpFilesService,
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

  @Post('transcribe/stream')
  @HttpCode(HttpStatus.OK)
  public async transcribeStream(@Req() req: FastifyRequest): Promise<TranscriptionResponseDto> {
    if (!req.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data')
    }

    this.logger.info('Received streaming transcription request')

    const streamAbortController = new AbortController()
    const onStreamClose = () => {
      if (!streamAbortController.signal.aborted) streamAbortController.abort()
    }

    req.raw.once('close', onStreamClose)
    req.raw.once('aborted', onStreamClose)

    try {
      const parts = req.parts()
      let audioUrl: string | undefined
      const multipartParams: any = {}

      for await (const part of parts) {
        if (part.type === 'file') {
          if (audioUrl) {
            this.logger.warn('Multiple files provided in multipart request')
            throw new BadRequestException('Only one file can be provided per request')
          }
          this.logger.debug(`Found file part: ${part.filename} (${part.mimetype})`)
          
          try {
            // 1. Forward stream to tmp-files service
            audioUrl = await this.tmpFiles.uploadStream(
              part.file,
              part.filename,
              part.mimetype,
              streamAbortController.signal
            )
          } catch (err: any) {
            this.logger.error(`Failed to upload stream: ${err.message}`)
            throw err
          }
        } else {
          // It's a field
          const fieldName = part.fieldname
          const value = part.value as any

          if (fieldName === 'provider') multipartParams.provider = value
          else if (fieldName === 'language') multipartParams.language = value
          else if (fieldName === 'apiKey') multipartParams.apiKey = value
          else if (fieldName === 'restorePunctuation') multipartParams.restorePunctuation = value === 'true' || value === true
          else if (fieldName === 'formatText') multipartParams.formatText = value === 'true' || value === true
          else if (fieldName === 'maxWaitMinutes') {
            const parsed = parseInt(value, 10)
            if (isNaN(parsed) || parsed < 1) {
              throw new BadRequestException('maxWaitMinutes must be a positive integer')
            }
            multipartParams.maxWaitMinutes = parsed
          }
        }
      }

      if (!audioUrl) {
        throw new BadRequestException('No file provided in multipart request')
      }

      // 2. Transcribe as usual using the temporary URL
      const result = await this.service.transcribeByUrl({
        ...multipartParams,
        audioUrl,
        signal: streamAbortController.signal,
        isInternalSource: true,
      })

      this.logger.info(
        `Stream transcription completed. Provider: ${result.provider}, Processing time: ${result.processingMs}ms`
      )
      return result
    } finally {
      req.raw.off('close', onStreamClose)
      req.raw.off('aborted', onStreamClose)
    }
  }
}
