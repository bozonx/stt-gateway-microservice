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
import {
  ASSEMBLYAI_API,
  HTTP_TIMEOUTS,
  RETRY_BEHAVIOR,
} from '../../common/constants/app.constants.js'

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

    // Check if already aborted before adding listeners (prevents race condition)
    if (externalSignal?.aborted || this.shutdownAbortController.signal.aborted) {
      abort()
      const cleanup = () => {
        this.activeAbortControllers.delete(ac)
      }
      return { signal: ac.signal, cleanup }
    }

    // Add listeners
    externalSignal?.addEventListener('abort', abort)
    this.shutdownAbortController.signal.addEventListener('abort', abort)

    // Double-check after adding listeners (double-check pattern)
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
      const trimmedLanguage = params.language?.trim()
      // Explicit source language when provided
      if (trimmedLanguage && trimmedLanguage.length > 0) {
        payload.language_code = trimmedLanguage
      } else {
        payload.language_detection = true
      }
      // Format text output (default: true)
      payload.format_text = params.formatText === false ? false : true

      this.logger.debug(
        `AssemblyAI create request: url=${apiUrl}, hasAuthHeader=${Boolean(
          headers.Authorization
        )}, punctuate=${Boolean(payload.punctuate)}, language_detection=${Boolean(
          payload.language_detection
        )}, language_code=${payload.language_code ?? 'default'}, format_text=${Boolean(
          payload.format_text
        )}`
      )

      const id = await (async () => {
        let lastError: any
        const maxRetries = this.cfg.maxRetries
        const retryDelayMs = this.cfg.retryDelayMs
        // Total attempts = 1 initial + maxRetries retries
        const totalAttempts = maxRetries + 1

        for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber++) {
          if (signal.aborted) {
            throw new HttpException('CLIENT_CLOSED_REQUEST', 499)
          }

          const isRetryAttempt = attemptNumber > 1
          const isLastAttempt = attemptNumber === totalAttempts

          if (isRetryAttempt) {
            const jitterPercent = HTTP_TIMEOUTS.RETRY_JITTER_PERCENT / 100
            const jitter = retryDelayMs * jitterPercent * (Math.random() * 2 - 1)
            const finalDelay = Math.max(0, retryDelayMs + jitter)
            this.logger.debug(
              `Retrying transcription creation (attempt ${attemptNumber}/${totalAttempts}) in ${Math.round(
                finalDelay
              )}ms`
            )
            await this.sleep(finalDelay, signal)
          }

          try {
            const create$ = this.http.post<AssemblyCreateResponse>(apiUrl, payload, {
              headers,
              validateStatus: () => true,
              signal,
              timeout: this.cfg.providerApiTimeoutSeconds * 1000,
            })

            const createRes = await lastValueFrom(create$)
            this.logger.debug(
              `AssemblyAI create response: status=${createRes.status}, hasId=${Boolean(
                createRes.data?.id
              )}`
            )

            if (createRes.status >= 400 || !createRes.data?.id) {
              const errorDetail = createRes.data
                ? JSON.stringify(createRes.data)
                : 'no response body'
              // Determine if error is retryable (429, 5xx, network errors)
              const isRetryable =
                createRes.status === 429 || createRes.status >= 500 || createRes.status === 0

              if (isRetryable && !isLastAttempt) {
                this.logger.warn(
                  `Failed to create transcription (retryable status ${createRes.status}). Error: ${errorDetail}`
                )
                lastError = new ServiceUnavailableException('Failed to create transcription')
                continue
              }

              this.logger.error(
                `Failed to create transcription. Status: ${createRes.status}, Response: ${errorDetail}`
              )
              throw new ServiceUnavailableException('Failed to create transcription')
            }

            // Success - log if it was a retry
            if (isRetryAttempt) {
              this.logger.info(
                `Transcription created successfully after ${attemptNumber - 1} retry attempt(s)`
              )
            }

            return createRes.data.id
          } catch (err: any) {
            if (signal.aborted) throw err
            // Determine if error is retryable (timeouts, network errors, 429, 5xx)
            const isRetryable =
              err.name === 'TimeoutError' ||
              err.code === 'ECONNABORTED' ||
              err.code === 'ETIMEDOUT' ||
              err.status >= 500 ||
              err.status === 429

            if (isRetryable && !isLastAttempt) {
              this.logger.warn(
                `Failed to create transcription (retryable error: ${err.message}). Attempting retry...`
              )
              lastError = err
              continue
            }
            throw err
          }
        }
        throw lastError
      })()

      this.logger.info(`Transcription request created with ID: ${id}`)

      const startedAt = Date.now()
      const maxWaitMinutes = params.maxWaitMinutes ?? this.cfg.defaultMaxWaitMinutes
      const deadline = startedAt + maxWaitMinutes * 60 * 1000

      // Poll loop with exponential backoff on errors
      let pollCount = 0
      let consecutiveErrors = 0
      let currentPollInterval = this.cfg.pollIntervalMs

      for (;;) {
        if (signal.aborted) {
          throw new HttpException('CLIENT_CLOSED_REQUEST', 499)
        }
        if (Date.now() > deadline) {
          this.logger.error(`Transcription timeout after ${maxWaitMinutes} minutes for ID: ${id}`)
          throw new GatewayTimeoutException('TRANSCRIPTION_TIMEOUT')
        }

        await this.sleep(currentPollInterval, signal)
        pollCount++

        let getRes
        try {
          const getUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}/${id}`
          const get$ = this.http.get<AssemblyTranscriptResponse>(getUrl, {
            headers,
            validateStatus: () => true,
            signal,
            timeout: this.cfg.providerApiTimeoutSeconds * 1000,
          })
          getRes = await lastValueFrom(get$)
          // Reset consecutive errors on successful request
          consecutiveErrors = 0
          currentPollInterval = this.cfg.pollIntervalMs
        } catch (err: any) {
          consecutiveErrors++
          // Determine if error is retryable (timeouts, network errors)
          const isRetryable =
            err.name === 'TimeoutError' ||
            err.code === 'ECONNABORTED' ||
            err.code === 'ETIMEDOUT' ||
            err.code === 'ECONNRESET'

          if (!isRetryable) {
            this.logger.error(`Non-retriable polling error for ID: ${id}: ${err.message}`)
            throw new ServiceUnavailableException('Polling failed')
          }

          if (consecutiveErrors >= RETRY_BEHAVIOR.MAX_CONSECUTIVE_POLL_ERRORS) {
            this.logger.error(
              `Too many consecutive polling errors (${consecutiveErrors}) for ID: ${id}`
            )
            throw new ServiceUnavailableException('Polling repeatedly failed')
          }

          // Apply exponential backoff
          currentPollInterval = Math.min(
            currentPollInterval * RETRY_BEHAVIOR.POLL_BACKOFF_MULTIPLIER,
            RETRY_BEHAVIOR.MAX_POLL_INTERVAL_MS
          )

          this.logger.warn(
            `Polling error ${consecutiveErrors}/${RETRY_BEHAVIOR.MAX_CONSECUTIVE_POLL_ERRORS} for ID: ${id}: ${err.message}. Retrying in ${Math.round(currentPollInterval)}ms...`
          )
          continue
        }

        const body: AssemblyTranscriptResponse | undefined = getRes.data
        this.logger.debug(
          `AssemblyAI poll response: status=${getRes.status}, bodyStatus=${body?.status ?? 'n/a'}`
        )

        // Distinguish between client errors (4xx) and server errors (5xx)
        if (getRes.status >= 400 && getRes.status < 500) {
          // Client errors (401, 403, 404, etc.) should not be retried
          this.logger.error(`Client error during polling for ID: ${id} (status ${getRes.status})`)
          throw new ServiceUnavailableException(`Polling failed with status ${getRes.status}`)
        }

        if (getRes.status >= 500 || !body) {
          consecutiveErrors++

          if (consecutiveErrors >= RETRY_BEHAVIOR.MAX_CONSECUTIVE_POLL_ERRORS) {
            this.logger.error(
              `Too many consecutive server errors (${consecutiveErrors}) for ID: ${id}`
            )
            throw new ServiceUnavailableException('Polling repeatedly failed')
          }

          // Apply exponential backoff
          currentPollInterval = Math.min(
            currentPollInterval * RETRY_BEHAVIOR.POLL_BACKOFF_MULTIPLIER,
            RETRY_BEHAVIOR.MAX_POLL_INTERVAL_MS
          )

          this.logger.warn(
            `Server error ${consecutiveErrors}/${RETRY_BEHAVIOR.MAX_CONSECUTIVE_POLL_ERRORS} for ID: ${id} (status ${getRes.status}). Retrying in ${Math.round(currentPollInterval)}ms...`
          )
          continue
        }

        // Reset on successful response
        consecutiveErrors = 0
        currentPollInterval = this.cfg.pollIntervalMs

        this.logger.debug(`Transcription status: ${body.status} for ID: ${id}`)

        if (body.status === 'completed') {
          this.logger.info(
            `Transcription completed for ID: ${id}. Text length: ${body.text?.length ?? 0} chars`
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
