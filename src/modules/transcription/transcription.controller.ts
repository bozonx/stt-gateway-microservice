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

    const data = await req.file()
    if (!data) {
      throw new BadRequestException('No file provided in multipart request')
    }

    const { file, filename, mimetype, fields } = data
    this.logger.debug(`Found file: ${filename} (${mimetype})`)

    // Extract other fields from the multipart request
    const multipartDto: Partial<TranscribeFileDto> = {}

    // Helper to map fields to DTO
    const mapField = (fieldName: string, targetKey: keyof TranscribeFileDto, type: 'string' | 'boolean' | 'number') => {
      const field = fields[fieldName] as any
      if (field?.value !== undefined) {
        if (type === 'boolean') {
          (multipartDto as any)[targetKey] = field.value === 'true' || field.value === true
        } else if (type === 'number') {
          (multipartDto as any)[targetKey] = parseInt(field.value, 10)
        } else {
          (multipartDto as any)[targetKey] = field.value
        }
      }
    }

    mapField('provider', 'provider', 'string')
    mapField('restorePunctuation', 'restorePunctuation', 'boolean')
    mapField('language', 'language', 'string')
    mapField('formatText', 'formatText', 'boolean')
    mapField('apiKey', 'apiKey', 'string')
    mapField('maxWaitMinutes', 'maxWaitMinutes', 'number')

    const streamAbortController = new AbortController()
    const onStreamClose = () => {
      if (!streamAbortController.signal.aborted) streamAbortController.abort()
    }

    req.raw.once('close', onStreamClose)
    req.raw.once('aborted', onStreamClose)

    try {
      // 1. Forward stream to tmp-files service
      const audioUrl = await this.tmpFiles.uploadStream(file, filename, mimetype)

      // 2. Transcribe as usual using the temporary URL
      const result = await this.service.transcribeByUrl({
        ...(multipartDto as TranscribeFileDto),
        audioUrl,
        signal: streamAbortController.signal,
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
