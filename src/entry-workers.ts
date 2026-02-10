import { createApp } from './app.js'
import { loadAppConfig } from './config/app.config.js'
import { loadSttConfig } from './config/stt.config.js'
import type { Logger } from './common/interfaces/logger.interface.js'

/**
 * Cloudflare Workers env bindings
 * Add your bindings here as needed
 */
interface Env {
  [key: string]: string | undefined
}

/**
 * Console-based logger for Cloudflare Workers
 */
function createWorkersLogger(level: string): Logger {
  const levels: Record<string, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
    silent: 70,
  }
  const threshold = levels[level] ?? 30

  const noop = () => {}

  return {
    debug: threshold <= 20 ? (msg: string) => console.debug(msg) : noop,
    info: threshold <= 30 ? (msg: string) => console.info(msg) : noop,
    warn: threshold <= 40 ? (msg: string) => console.warn(msg) : noop,
    error: threshold <= 50
      ? (msgOrObj: string | Record<string, unknown>, msg?: string) => {
          if (typeof msgOrObj === 'string') {
            console.error(msgOrObj)
          } else {
            console.error(msg, msgOrObj)
          }
        }
      : noop,
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const envRecord = env as Record<string, string | undefined>
    const appConfig = loadAppConfig(envRecord)
    const sttConfig = loadSttConfig(envRecord)
    const logger = createWorkersLogger(appConfig.logLevel)

    const { app } = createApp({ appConfig, sttConfig, logger })

    return app.fetch(request, env)
  },
}
