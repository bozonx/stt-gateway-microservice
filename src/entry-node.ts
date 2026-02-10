import { serve } from '@hono/node-server'
import pino from 'pino'
import { createApp } from './app.js'
import { loadAppConfig } from './config/app.config.js'
import { loadSttConfig } from './config/stt.config.js'
import { GRACEFUL_SHUTDOWN_TIMEOUT_MS } from './common/constants/app.constants.js'

const env = process.env as Record<string, string | undefined>
const appConfig = loadAppConfig(env)
const sttConfig = loadSttConfig(env)

const isDev = appConfig.nodeEnv === 'development'

const pinoLogger = pino({
  level: appConfig.logLevel,
  timestamp: () => `,"@timestamp":"${new Date().toISOString()}"`,
  base: {
    service: 'stt-gateway-microservice',
    environment: appConfig.nodeEnv,
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: false,
          translateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'",
          ignore: 'pid,hostname',
        },
      }
    : undefined,
})

const { app, assemblyAiProvider } = createApp({
  appConfig,
  sttConfig,
  logger: pinoLogger,
})

const server = serve(
  {
    fetch: app.fetch,
    port: appConfig.port,
    hostname: appConfig.host,
  },
  (info) => {
    const prefix = appConfig.basePath ? `/${appConfig.basePath}/api/v1` : '/api/v1'
    pinoLogger.info(`Server is running on: http://${appConfig.host}:${info.port}${prefix}`)
    pinoLogger.info(`Environment: ${appConfig.nodeEnv}`)
    pinoLogger.info(`Log level: ${appConfig.logLevel}`)
  }
)

function gracefulShutdown(signal: string) {
  pinoLogger.info(`${signal} received, starting graceful shutdown...`)

  assemblyAiProvider.shutdown()

  const forceTimeout = setTimeout(() => {
    pinoLogger.error('Graceful shutdown timeout exceeded, forcing exit')
    process.exit(1)
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS)

  server.close(() => {
    clearTimeout(forceTimeout)
    pinoLogger.info('Server closed gracefully')
    process.exit(0)
  })
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
