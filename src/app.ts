import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppConfig } from './config/app.config.js'
import type { SttConfig } from './config/stt.config.js'
import type { Logger } from './common/interfaces/logger.interface.js'
import { BadRequestError, HttpError } from './common/errors/http-error.js'
import { authMiddleware } from './common/middleware/auth.middleware.js'
import { TranscriptionService } from './modules/transcription/transcription.service.js'
import { TmpFilesService } from './modules/transcription/tmp-files.service.js'
import { AssemblyAiProvider } from './providers/assemblyai/assemblyai.provider.js'
import { SttProviderRegistry } from './providers/stt-provider.registry.js'
import {
  transcribeJsonSchema,
  transcribeStreamSchema,
} from './modules/transcription/transcription.schema.js'

/**
 * Application dependencies injected from the runtime entrypoint
 */
export interface AppDeps {
  appConfig: AppConfig
  sttConfig: SttConfig
  logger: Logger
}

/**
 * Creates the Hono application with all routes and middleware.
 * Platform-agnostic — works on both Node.js and Cloudflare Workers.
 */
export function createApp(deps: AppDeps) {
  const { appConfig, sttConfig, logger } = deps

  // Wire up services (manual DI)
  const assemblyAiProvider = new AssemblyAiProvider(sttConfig, logger)
  const registry = new SttProviderRegistry(assemblyAiProvider)
  const transcriptionService = new TranscriptionService(registry, sttConfig, logger)
  const tmpFilesService = new TmpFilesService(sttConfig, logger)

  // Build base path prefix
  const prefix = appConfig.basePath ? `/${appConfig.basePath}/api/v1` : '/api/v1'

  const app = new Hono()

  // Bearer authentication
  app.use('*', authMiddleware(appConfig.authBearerTokens, [`${prefix}/health`]))

  // Global error handler — consistent error response format
  app.onError((err, c) => {
    const status = err instanceof HttpError ? err.statusCode : 500
    const message = err instanceof Error ? err.message : 'Internal server error'

    if (status >= 500) {
      logger.error(
        {
          statusCode: status,
          path: c.req.path,
          method: c.req.method,
          errorName: err instanceof Error ? err.name : 'UnknownError',
          errorMessage: message,
          errorStack: err instanceof Error ? err.stack : undefined,
        },
        `${c.req.method} ${c.req.path} - ${status}`
      )
    } else {
      logger.warn(
        `${c.req.method} ${c.req.path} - ${status} - ${err instanceof Error ? err.name : 'Error'} - ${message}`
      )
    }

    return c.json(
      {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: c.req.path,
        method: c.req.method,
        message,
        error: err instanceof Error ? err.name : 'UnknownError',
      },
      status as any
    )
  })

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        statusCode: 404,
        timestamp: new Date().toISOString(),
        path: c.req.path,
        method: c.req.method,
        message: 'Not Found',
        error: 'NotFoundError',
      },
      404
    )
  })

  // Health check
  app.get(`${prefix}/health`, (c) => {
    return c.json({ status: 'ok' })
  })

  // POST /transcribe — JSON body
  app.post(`${prefix}/transcribe`, zValidator('json', transcribeJsonSchema), async (c) => {
    const payload = c.req.valid('json')

    logger.info(`Received transcription request for URL: ${payload.audioUrl}`)

    const abortController = new AbortController()

    // Listen for client disconnect if the runtime supports it
    c.req.raw.signal?.addEventListener('abort', () => {
      if (!abortController.signal.aborted) abortController.abort()
    })

    const result = await transcriptionService.transcribeByUrl({
      audioUrl: payload.audioUrl,
      provider: payload.provider,
      restorePunctuation: payload.restorePunctuation,
      language: payload.language,
      formatText: payload.formatText,
      apiKey: payload.apiKey,
      maxWaitMinutes: payload.maxWaitMinutes,
      signal: abortController.signal,
    })

    logger.info(
      `Transcription request completed. Provider: ${result.provider}, Processing time: ${result.processingMs}ms`
    )

    return c.json(result)
  })

  // POST /transcribe/stream — multipart/form-data
  app.post(`${prefix}/transcribe/stream`, zValidator('form', transcribeStreamSchema), async (c) => {
    const payload = c.req.valid('form')

    logger.info('Received streaming transcription request')

    const abortController = new AbortController()
    c.req.raw.signal?.addEventListener('abort', () => {
      if (!abortController.signal.aborted) abortController.abort()
    })

    logger.debug(`Found file: ${payload.file.name} (${payload.file.type})`)

    // Upload to tmp-files service
    const audioUrl = await tmpFilesService.uploadFile(
      payload.file,
      payload.file.name,
      payload.file.type || 'application/octet-stream',
      abortController.signal
    )

    const result = await transcriptionService.transcribeByUrl({
      audioUrl,
      provider: payload.provider,
      language: payload.language,
      apiKey: payload.apiKey,
      restorePunctuation: payload.restorePunctuation,
      formatText: payload.formatText,
      maxWaitMinutes: payload.maxWaitMinutes,
      signal: abortController.signal,
      isInternalSource: true,
    })

    logger.info(
      `Stream transcription completed. Provider: ${result.provider}, Processing time: ${result.processingMs}ms`
    )

    return c.json(result)
  })

  return { app, assemblyAiProvider }
}
