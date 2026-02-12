import type {
  SttProvider,
  TranscriptionRequestByUrl,
  TranscriptionResult,
} from '../../common/interfaces/stt-provider.interface.js'
import type { SttConfig } from '../../config/stt.config.js'
import type { Logger } from '../../common/interfaces/logger.interface.js'
import {
  ServiceUnavailableError,
  GatewayTimeoutError,
  ClientClosedRequestError,
} from '../../common/errors/http-error.js'
import {
  ASSEMBLYAI_API,
  HTTP_TIMEOUTS,
  RETRY_BEHAVIOR,
} from '../../common/constants/app.constants.js'
import { normalizeLanguageCode } from '../../utils/language.utils.js'

interface AssemblyCreateResponse {
  id: string
  status: string
  error?: string
}

interface AssemblyTranscriptResponse {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text?: string
  error?: string
  words?: Array<{ start: number; end: number; text: string; confidence?: number }>
  audio_duration?: number
  language_code?: string
  confidence?: number
}

export class AssemblyAiProvider implements SttProvider {
  public readonly capabilities = {
    restorePunctuation: true,
    formatText: true,
    models: true,
    wordTimings: true,
  } as const

  private readonly activeAbortControllers = new Set<AbortController>()
  private shutdownRequested = false

  constructor(
    private readonly cfg: SttConfig,
    private readonly logger: Logger
  ) {}

  private async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new ClientClosedRequestError()
    }
    await new Promise<void>((resolve, reject) => {
      let t: ReturnType<typeof setTimeout> | undefined
      const onAbort = () => {
        if (t) clearTimeout(t)
        signal?.removeEventListener('abort', onAbort)
        reject(new ClientClosedRequestError())
      }

      signal?.addEventListener('abort', onAbort, { once: true })

      t = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, ms)
    })
  }

  public shutdown(): void {
    this.shutdownRequested = true

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

    if (externalSignal?.aborted || this.shutdownRequested) {
      abort()
      const cleanup = () => {
        this.activeAbortControllers.delete(ac)
      }
      return { signal: ac.signal, cleanup }
    }

    externalSignal?.addEventListener('abort', abort)

    if (externalSignal?.aborted || this.shutdownRequested) {
      abort()
    }

    const cleanup = () => {
      externalSignal?.removeEventListener('abort', abort)
      this.activeAbortControllers.delete(ac)
    }

    return { signal: ac.signal, cleanup }
  }

  /**
   * Wraps fetch with a timeout via AbortSignal.timeout, linked to the provided signal
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    linkedSignal: AbortSignal
  ): Promise<Response> {
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const combined = AbortSignal.any([linkedSignal, timeoutSignal])
    return fetch(url, { ...init, signal: combined })
  }

  public async submitAndWaitByUrl(params: TranscriptionRequestByUrl): Promise<TranscriptionResult> {
    if (params.signal?.aborted) {
      throw new ClientClosedRequestError()
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

      const headers: Record<string, string> = {
        authorization: params.apiKey as string,
        'Content-Type': 'application/json',
      }
      const apiUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}`
      const payload: Record<string, unknown> = {
        audio_url: params.audioUrl,
      }
      if (params.models && params.models.length > 0) {
        payload.speech_models = params.models
      }
      payload.punctuate = params.restorePunctuation !== false
      const languageCode = normalizeLanguageCode(params.language)
      if (languageCode) {
        payload.language_code = languageCode
      } else {
        payload.language_detection = true
      }
      payload.format_text = params.formatText !== false

      this.logger.debug(
        `AssemblyAI create request: url=${apiUrl}, hasAuthHeader=${Boolean(
          headers.authorization
        )}, punctuate=${Boolean(payload.punctuate)}, language_detection=${Boolean(
          payload.language_detection
        )}, language_code=${(payload.language_code as string) ?? 'default'}, format_text=${Boolean(
          payload.format_text
        )}`
      )

      const timeoutMs = this.cfg.providerApiTimeoutSeconds * 1000

      const id = await (async () => {
        let lastError: unknown
        const maxRetries = this.cfg.maxRetries
        const retryDelayMs = this.cfg.retryDelayMs
        const totalAttempts = maxRetries + 1

        for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber++) {
          if (signal.aborted) {
            throw new ClientClosedRequestError()
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
            const res = await this.fetchWithTimeout(
              apiUrl,
              {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
              },
              timeoutMs,
              signal
            )

            const createResData = (await res.json()) as AssemblyCreateResponse

            this.logger.debug(
              `AssemblyAI create response: status=${res.status}, hasId=${Boolean(createResData?.id)}`
            )

            if (res.status >= 400 || !createResData?.id) {
              const errorDetail =
                createResData?.error ||
                (createResData ? JSON.stringify(createResData) : 'no response body')
              const isRetryable = res.status === 429 || res.status >= 500 || res.status === 0

              if (isRetryable && !isLastAttempt) {
                this.logger.warn(
                  `Failed to create transcription (retryable status ${res.status}). Error: ${errorDetail}`
                )
                lastError = new ServiceUnavailableError(
                  `Failed to create transcription: ${errorDetail}`
                )
                continue
              }

              this.logger.error(
                `Failed to create transcription. Status: ${res.status}, Response: ${errorDetail}`
              )
              throw new ServiceUnavailableError(`Failed to create transcription: ${errorDetail}`)
            }

            if (isRetryAttempt) {
              this.logger.info(
                `Transcription created successfully after ${attemptNumber - 1} retry attempt(s)`
              )
            }

            return createResData.id
          } catch (err: unknown) {
            if (signal.aborted) throw err
            const e = err as { name?: string; code?: string; status?: number; message?: string }
            const isRetryable =
              e.name === 'TimeoutError' ||
              e.code === 'ECONNABORTED' ||
              e.code === 'ETIMEDOUT' ||
              (e.status !== undefined && e.status >= 500) ||
              e.status === 429

            if (isRetryable && !isLastAttempt) {
              this.logger.warn(
                `Failed to create transcription (retryable error: ${e.message}). Attempting retry...`
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

      let consecutiveErrors = 0
      let currentPollInterval = this.cfg.pollIntervalMs

      for (;;) {
        if (signal.aborted) {
          throw new ClientClosedRequestError()
        }
        if (Date.now() > deadline) {
          this.logger.error(`Transcription timeout after ${maxWaitMinutes} minutes for ID: ${id}`)
          throw new GatewayTimeoutError('TRANSCRIPTION_TIMEOUT')
        }

        await this.sleep(currentPollInterval, signal)

        let statusCode = 0
        let responseBody: AssemblyTranscriptResponse | undefined

        try {
          const getUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}/${id}`

          const res = await this.fetchWithTimeout(
            getUrl,
            { method: 'GET', headers: { authorization: params.apiKey as string } },
            timeoutMs,
            signal
          )
          statusCode = res.status
          responseBody = (await res.json()) as AssemblyTranscriptResponse

          consecutiveErrors = 0
          currentPollInterval = this.cfg.pollIntervalMs
        } catch (err: unknown) {
          consecutiveErrors++
          const e = err as { name?: string; code?: string; message?: string }
          const isRetryable =
            e.name === 'TimeoutError' ||
            e.code === 'ECONNABORTED' ||
            e.code === 'ETIMEDOUT' ||
            e.code === 'ECONNRESET'

          if (!isRetryable) {
            this.logger.error(`Non-retriable polling error for ID: ${id}: ${e.message}`)
            throw new ServiceUnavailableError('Polling failed')
          }

          if (consecutiveErrors >= RETRY_BEHAVIOR.MAX_CONSECUTIVE_POLL_ERRORS) {
            this.logger.error(
              `Too many consecutive polling errors (${consecutiveErrors}) for ID: ${id}`
            )
            throw new ServiceUnavailableError('Polling repeatedly failed')
          }

          currentPollInterval = Math.min(
            currentPollInterval * RETRY_BEHAVIOR.POLL_BACKOFF_MULTIPLIER,
            RETRY_BEHAVIOR.MAX_POLL_INTERVAL_MS
          )

          this.logger.warn(
            `Polling error ${consecutiveErrors}/${RETRY_BEHAVIOR.MAX_CONSECUTIVE_POLL_ERRORS} for ID: ${id}: ${e.message}. Retrying in ${Math.round(
              currentPollInterval
            )}ms...`
          )
          continue
        }

        const body: AssemblyTranscriptResponse | undefined = responseBody
        this.logger.debug(
          `AssemblyAI poll response: status=${statusCode}, bodyStatus=${body?.status ?? 'n/a'}`
        )

        if (statusCode >= 400 && statusCode < 500) {
          const errMsg = responseBody?.error || `Polling failed with status ${statusCode}`
          this.logger.error(
            `Client error during polling for ID: ${id} (status ${statusCode}): ${errMsg}`
          )
          throw new ServiceUnavailableError(errMsg)
        }

        if (statusCode >= 500 || !body) {
          consecutiveErrors++

          if (consecutiveErrors >= RETRY_BEHAVIOR.MAX_CONSECUTIVE_POLL_ERRORS) {
            this.logger.error(
              `Too many consecutive server errors (${consecutiveErrors}) for ID: ${id}`
            )
            throw new ServiceUnavailableError('Polling repeatedly failed')
          }

          currentPollInterval = Math.min(
            currentPollInterval * RETRY_BEHAVIOR.POLL_BACKOFF_MULTIPLIER,
            RETRY_BEHAVIOR.MAX_POLL_INTERVAL_MS
          )

          this.logger.warn(
            `Server error ${consecutiveErrors}/${RETRY_BEHAVIOR.MAX_CONSECUTIVE_POLL_ERRORS} for ID: ${id} (status ${statusCode}). Retrying in ${Math.round(
              currentPollInterval
            )}ms...`
          )
          continue
        }

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
            words: params.includeWords
              ? (body.words?.map(
                  (w: { start: number; end: number; text: string; confidence?: number }) => ({
                    start: w.start,
                    end: w.end,
                    text: w.text,
                    confidence: w.confidence,
                  })
                ) ?? undefined)
              : undefined,
            punctuationRestored: params.restorePunctuation ?? true,
            raw: body,
          }
        }

        if (body.status === 'error') {
          const detail = body.error || 'Unknown error'
          this.logger.error(`Transcription failed for ID: ${id}. Error: ${detail}`)
          throw new ServiceUnavailableError(`Transcription failed: ${detail}`)
        }
      }
    } finally {
      cleanup()
    }
  }
}
