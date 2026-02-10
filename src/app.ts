import { Hono } from 'hono'
import type { AppConfig } from './config/app.config.js'
import type { SttConfig } from './config/stt.config.js'
import type { Logger } from './common/interfaces/logger.interface.js'
import { HttpError } from './common/errors/http-error.js'
import { TranscriptionService } from './modules/transcription/transcription.service.js'
import { TmpFilesService } from './modules/transcription/tmp-files.service.js'
import { AssemblyAiProvider } from './providers/assemblyai/assemblyai.provider.js'
import { SttProviderRegistry } from './providers/stt-provider.registry.js'

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

  // Global error handler — consistent error response format
  app.onError((err, c) => {
    const status = err instanceof HttpError ? err.statusCode : 500
    const message = err instanceof Error ? err.message : 'Internal server error'

    if (status >= 500) {
      logger.error(`${c.req.method} ${c.req.path} - ${status} - ${message}`)
    } else {
      logger.warn(`${c.req.method} ${c.req.path} - ${status} - ${message}`)
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
  app.post(`${prefix}/transcribe`, async (c) => {
    const body = await c.req.json()

    // Validate required field
    if (!body.audioUrl || typeof body.audioUrl !== 'string') {
      return c.json(
        {
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: c.req.path,
          method: c.req.method,
          message: 'audioUrl is required and must be a string',
          error: 'BadRequestError',
        },
        400
      )
    }

    // Validate audioUrl format
    if (!/^https?:\/\//i.test(body.audioUrl)) {
      return c.json(
        {
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: c.req.path,
          method: c.req.method,
          message: 'audioUrl must start with http or https',
          error: 'BadRequestError',
        },
        400
      )
    }

    // Validate optional boolean fields
    for (const field of ['restorePunctuation', 'formatText']) {
      if (body[field] !== undefined && typeof body[field] !== 'boolean') {
        return c.json(
          {
            statusCode: 400,
            timestamp: new Date().toISOString(),
            path: c.req.path,
            method: c.req.method,
            message: `${field} must be a boolean`,
            error: 'BadRequestError',
          },
          400
        )
      }
    }

    // Validate optional string fields
    for (const field of ['provider', 'language', 'apiKey']) {
      if (body[field] !== undefined && typeof body[field] !== 'string') {
        return c.json(
          {
            statusCode: 400,
            timestamp: new Date().toISOString(),
            path: c.req.path,
            method: c.req.method,
            message: `${field} must be a string`,
            error: 'BadRequestError',
          },
          400
        )
      }
    }

    // Validate maxWaitMinutes
    if (body.maxWaitMinutes !== undefined) {
      if (typeof body.maxWaitMinutes !== 'number' || body.maxWaitMinutes < 1) {
        return c.json(
          {
            statusCode: 400,
            timestamp: new Date().toISOString(),
            path: c.req.path,
            method: c.req.method,
            message: 'maxWaitMinutes must be a number >= 1',
            error: 'BadRequestError',
          },
          400
        )
      }
    }

    logger.info(`Received transcription request for URL: ${body.audioUrl}`)

    const abortController = new AbortController()

    // Listen for client disconnect if the runtime supports it
    c.req.raw.signal?.addEventListener('abort', () => {
      if (!abortController.signal.aborted) abortController.abort()
    })

    const result = await transcriptionService.transcribeByUrl({
      audioUrl: body.audioUrl,
      provider: body.provider,
      restorePunctuation: body.restorePunctuation,
      language: body.language,
      formatText: body.formatText,
      apiKey: body.apiKey,
      maxWaitMinutes: body.maxWaitMinutes,
      signal: abortController.signal,
    })

    logger.info(
      `Transcription request completed. Provider: ${result.provider}, Processing time: ${result.processingMs}ms`
    )

    return c.json(result)
  })

  // POST /transcribe/stream — multipart/form-data
  app.post(`${prefix}/transcribe/stream`, async (c) => {
    const contentType = c.req.header('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return c.json(
        {
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: c.req.path,
          method: c.req.method,
          message: 'Request must be multipart/form-data',
          error: 'BadRequestError',
        },
        400
      )
    }

    logger.info('Received streaming transcription request')

    const abortController = new AbortController()
    c.req.raw.signal?.addEventListener('abort', () => {
      if (!abortController.signal.aborted) abortController.abort()
    })

    const body = await c.req.parseBody({ all: true })

    // Extract file
    const file = body['file']
    if (!file || !(file instanceof File)) {
      return c.json(
        {
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: c.req.path,
          method: c.req.method,
          message: 'No file provided in multipart request',
          error: 'BadRequestError',
        },
        400
      )
    }

    logger.debug(`Found file: ${file.name} (${file.type})`)

    // Upload to tmp-files service
    const audioUrl = await tmpFilesService.uploadFile(
      file,
      file.name,
      file.type,
      abortController.signal
    )

    // Extract optional fields
    const provider = typeof body['provider'] === 'string' ? body['provider'] : undefined
    const language = typeof body['language'] === 'string' ? body['language'] : undefined
    const apiKey = typeof body['apiKey'] === 'string' ? body['apiKey'] : undefined
    const rpRaw = String(body['restorePunctuation'] ?? '')
    const restorePunctuation = rpRaw === 'true' ? true : rpRaw === 'false' ? false : undefined
    const ftRaw = String(body['formatText'] ?? '')
    const formatText = ftRaw === 'true' ? true : ftRaw === 'false' ? false : undefined

    let maxWaitMinutes: number | undefined
    const rawMaxWait = body['maxWaitMinutes']
    if (typeof rawMaxWait === 'string') {
      const parsed = parseInt(rawMaxWait, 10)
      if (!isNaN(parsed) && parsed >= 1) {
        maxWaitMinutes = parsed
      }
    }

    const result = await transcriptionService.transcribeByUrl({
      audioUrl,
      provider,
      language,
      apiKey,
      restorePunctuation,
      formatText,
      maxWaitMinutes,
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
