import type {
  SttProvider,
  TranscriptionResult,
} from '../../common/interfaces/stt-provider.interface.js'
import type { SttConfig } from '../../config/stt.config.js'
import type { Logger } from '../../common/interfaces/logger.interface.js'
import {
  BadRequestError,
  UnauthorizedError,
  HttpError,
  ClientClosedRequestError,
  InternalServerError,
} from '../../common/errors/http-error.js'
import { isPrivateHost } from '../../utils/network.utils.js'
import { isAbortError } from '../../utils/error.utils.js'
import type { SttProviderRegistry } from '../../providers/stt-provider.registry.js'

export class TranscriptionService {
  constructor(
    private readonly registry: SttProviderRegistry,
    private readonly cfg: SttConfig,
    private readonly logger: Logger
  ) {}

  private selectProvider(name?: string): SttProvider {
    const providerName = (name ?? this.cfg.defaultProvider).toLowerCase()
    this.logger.debug(`Using provider: ${providerName}`)

    if (this.cfg.allowedProviders && this.cfg.allowedProviders.length > 0) {
      if (!this.cfg.allowedProviders.includes(providerName)) {
        this.logger.warn(`Unsupported provider requested: ${providerName}`)
        throw new BadRequestError('Unsupported provider')
      }
    }

    const selected = this.registry.get(providerName)
    if (selected) return selected

    this.logger.warn(`Provider not available: ${providerName}`)
    throw new BadRequestError('Unsupported provider')
  }

  private enforceProviderCapabilities(
    providerName: string,
    provider: SttProvider,
    params: {
      restorePunctuation?: boolean
      formatText?: boolean
      models?: string[]
    }
  ): void {
    const unsupported: string[] = []

    if (params.restorePunctuation !== undefined && !provider.capabilities.restorePunctuation) {
      unsupported.push('restorePunctuation')
    }

    if (params.formatText !== undefined && !provider.capabilities.formatText) {
      unsupported.push('formatText')
    }

    if (params.models !== undefined && params.models.length > 0 && !provider.capabilities.models) {
      unsupported.push('models')
    }

    if (unsupported.length > 0) {
      throw new BadRequestError(
        `Unsupported options for provider '${providerName}': ${unsupported.join(', ')}`
      )
    }
  }

  private async enforceSizeLimitIfKnown(audioUrl: string, signal?: AbortSignal) {
    const hostForLog = (() => {
      try {
        return new URL(audioUrl).hostname
      } catch {
        return undefined
      }
    })()
    this.logger.debug(
      hostForLog ? `Checking file size for host: ${hostForLog}` : 'Checking file size'
    )
    try {
      const timeoutSignal = AbortSignal.timeout(this.cfg.providerApiTimeoutSeconds * 1000)
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
      const res = await fetch(audioUrl, { method: 'HEAD', signal: combinedSignal })
      const lenStr = res.headers.get('content-length')
      const len = lenStr ? parseInt(lenStr, 10) : undefined

      if (len) {
        this.logger.debug(`File size: ${len} bytes (${(len / 1024 / 1024).toFixed(2)} MB)`)
        if (len > this.cfg.maxFileMb * 1024 * 1024) {
          this.logger.warn(`File too large: ${len} bytes exceeds limit of ${this.cfg.maxFileMb}MB`)
          throw new BadRequestError('File too large')
        }
      } else {
        this.logger.debug('Content-Length header not available, skipping size check')
      }
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error
      }
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.debug(`HEAD request failed, skipping size check: ${msg}`)
    }
  }

  public async transcribeByUrl(params: {
    audioUrl: string
    provider?: string
    restorePunctuation?: boolean
    apiKey?: string
    language?: string
    formatText?: boolean
    maxWaitMinutes?: number
    models?: string[]
    signal?: AbortSignal
    isInternalSource?: boolean
  }): Promise<{
    text: string
    provider: string
    requestId: string
    durationSec?: number
    language?: string
    confidenceAvg?: number
    wordsCount?: number
    processingMs: number
    punctuationRestored: boolean
    raw: unknown
  }> {
    const hostForLog = (() => {
      try {
        return new URL(params.audioUrl).hostname
      } catch {
        return undefined
      }
    })()
    this.logger.info(
      hostForLog
        ? `Starting transcription for host: ${hostForLog}`
        : 'Starting transcription request'
    )

    let parsed: URL
    try {
      parsed = new URL(params.audioUrl)
    } catch {
      this.logger.error('Invalid URL provided')
      throw new BadRequestError('audioUrl must be a valid URL')
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      this.logger.error(`Unsupported protocol: ${parsed.protocol}`)
      throw new BadRequestError('Only http(s) URLs are allowed')
    }

    if (!params.isInternalSource && isPrivateHost(parsed)) {
      this.logger.error(`Private host not allowed: ${parsed.hostname}`)
      throw new BadRequestError('Private/loopback hosts are not allowed')
    }

    if (params.signal?.aborted) {
      throw new ClientClosedRequestError()
    }

    if (!params.isInternalSource) {
      await this.enforceSizeLimitIfKnown(params.audioUrl, params.signal)
    } else {
      this.logger.debug('Skipping size check for internal source')
    }

    const provider = this.selectProvider(params.provider)
    const providerName = (params.provider ?? this.cfg.defaultProvider).toLowerCase()
    this.enforceProviderCapabilities(providerName, provider, {
      restorePunctuation: params.restorePunctuation,
      formatText: params.formatText,
      models: params.models,
    })

    const apiKeyToUse = params.apiKey || this.cfg.assemblyAiApiKey
    if (!apiKeyToUse) {
      this.logger.error('Missing provider API key')
      throw new UnauthorizedError('Missing provider API key')
    }

    const start = Date.now()
    let result: TranscriptionResult
    try {
      this.logger.debug('Submitting transcription request to provider')
      const trimmedLanguage = params.language?.trim()

      result = await provider.submitAndWaitByUrl({
        audioUrl: params.audioUrl,
        apiKey: apiKeyToUse,
        signal: params.signal,
        restorePunctuation: params.restorePunctuation,
        language: trimmedLanguage,
        formatText: params.formatText,
        models: params.models,
        maxWaitMinutes: params.maxWaitMinutes ?? this.cfg.defaultMaxWaitMinutes,
      })
    } catch (err: unknown) {
      if (params.signal?.aborted || isAbortError(err)) {
        throw new ClientClosedRequestError()
      }
      if (err instanceof HttpError) {
        // Log errors with status check for better visibility
        if (err.statusCode >= 500) {
          this.logger.error(`Transcription failed with provider error: ${err.message}`)
        } else {
          this.logger.warn(`Transcription rejected: ${err.message}`)
        }
        throw err
      }

      // If it's not an HttpError, it's an unexpected system error (bug/crash)
      const em = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      this.logger.error({ err: em, stack }, `Unexpected error during transcription: ${em}`)

      throw new InternalServerError(`Transcription failed due to an internal error: ${em}`)
    }
    const processingMs = Date.now() - start

    this.logger.info(
      `Transcription completed in ${processingMs}ms. Text length: ${result.text.length} chars`
    )

    return {
      text: result.text,
      provider: providerName,
      requestId: result.requestId,
      durationSec: result.durationSec,
      language: result.language,
      confidenceAvg: result.confidenceAvg,
      wordsCount: result.words?.length,
      processingMs,
      punctuationRestored: result.punctuationRestored ?? params.restorePunctuation ?? true,
      raw: result.raw,
    }
  }
}
