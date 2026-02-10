import type { Hono } from 'hono'
import { createApp } from '../../src/app.js'
import { loadAppConfig } from '../../src/config/app.config.js'
import { loadSttConfig } from '../../src/config/stt.config.js'
import { createMockLogger } from '../helpers/mocks.js'

/**
 * Creates a Hono test app instance for e2e tests.
 * Uses app.request() for testing — no real HTTP server needed.
 */
export function createTestApp(): Hono {
  const appConfig = loadAppConfig(process.env as Record<string, string | undefined>)
  const sttConfig = loadSttConfig(process.env as Record<string, string | undefined>)
  const logger = createMockLogger()
  const { app } = createApp({ appConfig, sttConfig, logger })
  return app
}
