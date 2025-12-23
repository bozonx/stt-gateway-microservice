import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { lastValueFrom } from 'rxjs'
import { HttpService } from '@nestjs/axios'
import type {
  SttProvider,
  TranscriptionResult,
} from '../../common/interfaces/stt-provider.interface.js'
import type { SttConfig } from '../../config/stt.config.js'
import { isPrivateHost } from '../../utils/network.utils.js'
import { SttProviderRegistry } from '../../providers/stt-provider.registry.js'
import { STT_PROVIDER } from '../../common/constants/tokens.js'

@Injectable()
export class TranscriptionService {
  private readonly cfg: SttConfig

  constructor(
    private readonly http: HttpService,
    @Optional() private readonly registry: SttProviderRegistry | undefined,
    private readonly configService: ConfigService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
    @Optional() @Inject(STT_PROVIDER) private readonly legacyProvider?: SttProvider
  ) {
    this.cfg = this.configService.get<SttConfig>('stt')!
    logger.setContext(TranscriptionService.name)
  }

  private selectProvider(name?: string): SttProvider {
    const providerName = (name ?? this.cfg.defaultProvider).toLowerCase()
    this.logger.debug(`Using provider: ${providerName}`)

    if (this.cfg.allowedProviders && this.cfg.allowedProviders.length > 0) {
      if (!this.cfg.allowedProviders.includes(providerName)) {
        this.logger.warn(`Unsupported provider requested: ${providerName}`)
        throw new BadRequestException('Unsupported provider')
      }
    }

    const selected = this.registry?.get(providerName)
    if (selected) return selected

    // Backward compatibility for tests that inject STT_PROVIDER directly
    if (this.legacyProvider) {
      this.logger.debug('Falling back to legacy injected provider')
      return this.legacyProvider
    }

    this.logger.warn(`Provider not available: ${providerName}`)
    throw new BadRequestException('Unsupported provider')
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
      const req$ = this.http.head(audioUrl, {
        validateStatus: () => true,
        signal,
        timeout: this.cfg.requestTimeoutSeconds * 1000,
      })
      const res = await lastValueFrom(req$)
      const len = res.headers['content-length']
        ? parseInt(res.headers['content-length'] as string, 10)
        : undefined

      if (len) {
        this.logger.debug(`File size: ${len} bytes (${(len / 1024 / 1024).toFixed(2)} MB)`)
        if (len > this.cfg.maxFileMb * 1024 * 1024) {
          this.logger.warn(`File too large: ${len} bytes exceeds limit of ${this.cfg.maxFileMb}MB`)
          throw new BadRequestException('File too large')
        }
      } else {
        this.logger.debug('Content-Length header not available, skipping size check')
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.debug(`HEAD request failed, skipping size check: ${msg}`)
      // HEAD may fail or be blocked; we ignore unless explicit oversized length was detected
    }
  }

  public async transcribeByUrl(params: {
    audioUrl: string
    provider?: string
    restorePunctuation?: boolean
    apiKey?: string
    language?: string /** Explicit source language code */
    formatText?: boolean
    totalTimeoutMinutes?: number
    maxRetries?: number
    retryDelayMs?: number
    signal?: AbortSignal
  }): Promise<{
    text: string
    provider: string
    requestId: string
    durationSec?: number
    language?: string /** Detected or specified source language */
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
      throw new BadRequestException('audioUrl must be a valid URL')
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      this.logger.error(`Unsupported protocol: ${parsed.protocol}`)
      throw new BadRequestException('Only http(s) URLs are allowed')
    }

    if (isPrivateHost(parsed)) {
      this.logger.error(`Private host not allowed: ${parsed.hostname}`)
      throw new BadRequestException('Private/loopback hosts are not allowed')
    }

    if (params.signal?.aborted) {
      throw new HttpException('CLIENT_CLOSED_REQUEST', 499)
    }

    await this.enforceSizeLimitIfKnown(params.audioUrl, params.signal)

    const provider = this.selectProvider(params.provider)

    const apiKeyToUse = params.apiKey || this.cfg.assemblyAiApiKey
    if (!apiKeyToUse) {
      this.logger.error('Missing provider API key')
      throw new UnauthorizedException('Missing provider API key')
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
        totalTimeoutMinutes: params.totalTimeoutMinutes ?? this.cfg.totalTimeoutMinutes,
        maxRetries: params.maxRetries ?? this.cfg.maxRetries,
        retryDelayMs: params.retryDelayMs ?? this.cfg.retryDelayMs,
      })
    } catch (err: unknown) {
      if (params.signal?.aborted) {
        throw new HttpException('CLIENT_CLOSED_REQUEST', 499)
      }
      if (err instanceof HttpException) {
        this.logger.error(`Transcription failed with HTTP error: ${err.message}`)
        throw err
      }
      const em = err instanceof Error ? err.message : String(err)
      this.logger.error(`Transcription timeout or unknown error: ${em}`)
      throw new GatewayTimeoutException('TRANSCRIPTION_TIMEOUT')
    }
    const processingMs = Date.now() - start

    this.logger.info(
      `Transcription completed in ${processingMs}ms. Text length: ${result.text.length} chars`
    )

    return {
      text: result.text,
      provider: (params.provider ?? this.cfg.defaultProvider).toLowerCase(),
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
