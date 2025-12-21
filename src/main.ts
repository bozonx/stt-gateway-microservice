import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import type { AppConfig } from './config/app.config.js'
import { GRACEFUL_SHUTDOWN_TIMEOUT_MS } from './common/constants/app.constants.js'

async function bootstrap() {
  // Set Fastify bodyLimit to 100 MB (in bytes)
  const bodyLimitBytes = 100 * 1024 * 1024

  // Create app with bufferLogs enabled to capture early logs
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      bodyLimit: bodyLimitBytes,
      forceCloseConnections: true,
      requestTimeout: 30000,
    }),
    {
      bufferLogs: true,
    }
  )

  // Use Pino logger for the entire application
  app.useLogger(app.get(Logger))

  const configService = app.get(ConfigService)
  const logger = app.get(Logger)

  const appConfig = configService.get<AppConfig>('app')!

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  )

  // Configure global API prefix from configuration
  const globalPrefix = appConfig.basePath ? `${appConfig.basePath}/api/v1` : 'api/v1'
  app.setGlobalPrefix(globalPrefix)

  // Enable graceful shutdown
  app.enableShutdownHooks()

  await app.listen(appConfig.port, appConfig.host)

  logger.log(
    `🚀 NestJS service is running on: http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
    'Bootstrap'
  )
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap')
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap')

  setupFatalProcessHandlers(app, logger)
}

function setupFatalProcessHandlers(app: NestFastifyApplication, logger: Logger) {
  let isShuttingDown = false

  const shutdown = async (reason: string, err?: unknown) => {
    if (isShuttingDown) return
    isShuttingDown = true

    if (err instanceof Error) {
      logger.error({ err }, `Fatal process event: ${reason}`)
    } else if (err !== undefined) {
      logger.error({ err }, `Fatal process event: ${reason}`)
    } else {
      logger.error(`Fatal process event: ${reason}`)
    }

    const forceShutdownTimer = setTimeout(() => {
      logger.fatal(
        `Shutdown timeout (${GRACEFUL_SHUTDOWN_TIMEOUT_MS}ms) exceeded after ${reason}, forcing exit`
      )
      process.exit(1)
    }, GRACEFUL_SHUTDOWN_TIMEOUT_MS)

    try {
      await app.close()
      clearTimeout(forceShutdownTimer)
      process.exitCode = 1
    } catch (closeErr) {
      clearTimeout(forceShutdownTimer)
      logger.fatal({ err: closeErr }, `Error during shutdown after ${reason}`)
      process.exit(1)
    }
  }

  process.on('unhandledRejection', (reason: unknown) => {
    void shutdown('unhandledRejection', reason)
  })

  process.on('uncaughtException', (error: Error) => {
    void shutdown('uncaughtException', error)
  })
}

void bootstrap()
