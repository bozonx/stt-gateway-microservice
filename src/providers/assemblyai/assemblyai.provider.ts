import { HttpService } from '@nestjs/axios'
import {
  Injectable,
  ServiceUnavailableException,
  GatewayTimeoutException,
  HttpException,
  Inject,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { lastValueFrom } from 'rxjs'
import type {
  SttProvider,
  TranscriptionRequestByUrl,
  TranscriptionResult,
} from '../../common/interfaces/stt-provider.interface.js'
import type { SttConfig } from '../../config/stt.config.js'
import { ASSEMBLYAI_API } from '../../common/constants/app.constants.js'

interface AssemblyCreateResponse {
  id: string
  status: string
}

interface AssemblyTranscriptResponse {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text?: string
  error?: string
  words?: Array<{ start: number; end: number; text: string; confidence?: number }>
  audio_duration?: number
  language_code?: string
  confidence?: number // some payloads expose average confidence
}

@Injectable()
export class AssemblyAiProvider implements SttProvider {
  private readonly cfg: SttConfig
  private readonly activeAbortControllers = new Set<AbortController>()
  private readonly shutdownAbortController = new AbortController()

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    @Inject(PinoLogger) private readonly logger: PinoLogger
  ) {
    this.cfg = this.configService.get<SttConfig>('stt')!
    logger.setContext(AssemblyAiProvider.name)
  }

  private async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new HttpException('CLIENT_CLOSED_REQUEST', 499)
    }
    await new Promise<void>((resolve, reject) => {
      let t: NodeJS.Timeout | undefined
      const onAbort = () => {
        if (t) clearTimeout(t)
        signal?.removeEventListener('abort', onAbort)
        reject(new HttpException('CLIENT_CLOSED_REQUEST', 499))
      }

      signal?.addEventListener('abort', onAbort, { once: true })

      t = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, ms)
    })
  }

  public onApplicationShutdown(): void {
    if (!this.shutdownAbortController.signal.aborted) {
      this.shutdownAbortController.abort()
    }

    for (const ac of this.activeAbortControllers) {
      if (!ac.signal.aborted) {
        ac.abort()
      }
    }
  }

  private createLinkedAbortSignal(externalSignal?: AbortSignal): {
    signal: AbortSignal
    cleanup: () => void
  } {
    const ac = new AbortController()
    this.activeAbortControllers.add(ac)

    const abort = () => {
      if (!ac.signal.aborted) ac.abort()
    }

    externalSignal?.addEventListener('abort', abort)
    this.shutdownAbortController.signal.addEventListener('abort', abort)

    if (externalSignal?.aborted || this.shutdownAbortController.signal.aborted) {
      abort()
    }

    const cleanup = () => {
      externalSignal?.removeEventListener('abort', abort)
      this.shutdownAbortController.signal.removeEventListener('abort', abort)
      this.activeAbortControllers.delete(ac)
    }

    return { signal: ac.signal, cleanup }
  }

  public async submitAndWaitByUrl(params: TranscriptionRequestByUrl): Promise<TranscriptionResult> {
    if (params.signal?.aborted) {
      throw new HttpException('CLIENT_CLOSED_REQUEST', 499)
    }

    const { signal, cleanup } = this.createLinkedAbortSignal(params.signal)
    try {
      const hostForLog = (() => {
        try {
          return new URL(params.audioUrl).hostname
        } catch {
          return undefined
        }
      })()
      this.logger.debug(
        hostForLog
          ? `Submitting transcription request to AssemblyAI for host: ${hostForLog}`
          : 'Submitting transcription request to AssemblyAI'
      )

      const headers = { Authorization: params.apiKey as string }
      const apiUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}`
      const payload: Record<string, any> = {
        audio_url: params.audioUrl,
      }
      payload.punctuate = params.restorePunctuation === false ? false : true
      // Explicit language when provided
      if (params.language) {
        const trimmed = params.language.trim()
        if (trimmed.length > 0) {
          payload.language_code = trimmed
        }
      }
      // Format text output (default: true)
      payload.format_text = params.formatText === false ? false : true

      this.logger.debug(
        `AssemblyAI create request: url=${apiUrl}, hasAuthHeader=${Boolean(
          headers.Authorization
        )}, punctuate=${Boolean(payload.punctuate)}, language_code=${
          payload.language_code ?? 'auto'
        }, format_text=${Boolean(payload.format_text)}`
      )

      const create$ = this.http.post<AssemblyCreateResponse>(apiUrl, payload, {
        headers,
        validateStatus: () => true,
        signal,
        timeout: this.cfg.requestTimeoutSeconds * 1000,
      })

      const createRes = await lastValueFrom(create$)
      this.logger.debug(
        `AssemblyAI create response: status=${createRes.status}, hasId=${Boolean(createRes.data?.id)}`
      )
      if (createRes.status >= 400 || !createRes.data?.id) {
        const errorDetail = createRes.data ? JSON.stringify(createRes.data) : 'no response body'
        this.logger.error(
          `Failed to create transcription. Status: ${createRes.status}, Response: ${errorDetail}`
        )
        throw new ServiceUnavailableException('Failed to create transcription')
      }

      const id = createRes.data.id
      this.logger.info(`Transcription request created with ID: ${id}`)

      const startedAt = Date.now()
      const deadline = startedAt + this.cfg.maxSyncWaitMinutes * 60 * 1000

      // Poll loop
      let pollCount = 0
      for (;;) {
        if (signal.aborted) {
          throw new HttpException('CLIENT_CLOSED_REQUEST', 499)
        }
        if (Date.now() > deadline) {
          this.logger.error(
            `Transcription timeout after ${this.cfg.maxSyncWaitMinutes} minutes for ID: ${id}`
          )
          throw new GatewayTimeoutException('TRANSCRIPTION_TIMEOUT')
        }

        await this.sleep(this.cfg.pollIntervalMs, signal)
        pollCount++

        this.logger.debug(`Polling transcription status (attempt ${pollCount}) for ID: ${id}`)

        const getUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}/${id}`
        const get$ = this.http.get<AssemblyTranscriptResponse>(getUrl, {
          headers,
          validateStatus: () => true,
          signal,
          timeout: this.cfg.requestTimeoutSeconds * 1000,
        })
        const getRes = await lastValueFrom(get$)
        const body = getRes.data
        this.logger.debug(
          `AssemblyAI poll response: status=${getRes.status}, bodyStatus=${body?.status ?? 'n/a'}`
        )

        if (!body) {
          this.logger.debug(`No response body for ID: ${id}, continuing...`)
          continue
        }

        this.logger.debug(`Transcription status: ${body.status} for ID: ${id}`)

        if (body.status === 'completed') {
          this.logger.info(
            `Transcription completed for ID: ${id}. Text length: ${body.text?.length || 0} chars`
          )
          return {
            text: body.text ?? '',
            requestId: id,
            durationSec: body.audio_duration,
            language: body.language_code,
            confidenceAvg: body.confidence,
            words:
              body.words?.map((w: { start: number; end: number; text: string }) => ({
                start: w.start,
                end: w.end,
                text: w.text,
              })) ?? undefined,
            punctuationRestored: params.restorePunctuation ?? true,
            raw: body,
          }
        }

        if (body.status === 'error') {
          this.logger.error(
            `Transcription failed for ID: ${id}. Error: ${body.error ?? 'Unknown error'}`
          )
          throw new ServiceUnavailableException(body.error ?? 'Transcription failed')
        }
      }
    } finally {
      cleanup()
    }
  }
}
