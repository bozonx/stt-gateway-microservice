import { createApp } from './app.js'
import { loadAppConfig } from './config/app.config.js'
import { loadSttConfig } from './config/stt.config.js'
import type { Logger } from './common/interfaces/logger.interface.js'

/**
 * Cloudflare Workers env bindings
 * Add your bindings here as needed
 */
interface Env extends Record<string, unknown> {
  'tmp-files'?: { fetch: typeof fetch }
}

/**
 * JSON-based logger for Cloudflare Workers to match Pino format
 */
function createWorkersLogger(level: string, env: string): Logger {
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

  const log = (lvlName: string, lvlNum: number, msgOrObj: any, msg?: string) => {
    if (lvlNum < threshold) return

    const logObj: Record<string, any> = {
      level: lvlNum,
      time: Date.now(),
      hostname: 'workers',
      environment: env,
      service: 'stt-gateway-microservice',
    }

    if (typeof msgOrObj === 'string') {
      logObj.msg = msgOrObj
    } else {
      Object.assign(logObj, msgOrObj)
      if (msg) logObj.msg = msg
    }

    console.log(JSON.stringify(logObj))
  }

  return {
    debug: (msg: any) => log('debug', 20, msg),
    info: (msg: any) => log('info', 30, msg),
    warn: (msg: any) => log('warn', 40, msg),
    error: (msgOrObj: any, msg?: string) => log('error', 50, msgOrObj, msg),
  }
}

let cachedApp: any = null

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!cachedApp) {
      const envRecord = env as Record<string, string | undefined>
      const appConfig = loadAppConfig(envRecord)
      const sttConfig = loadSttConfig(envRecord)
      const logger = createWorkersLogger(appConfig.logLevel, appConfig.nodeEnv)

      const tmpFilesBinding = env['tmp-files']
      const tmpFilesFetcher = tmpFilesBinding
        ? tmpFilesBinding.fetch.bind(tmpFilesBinding)
        : undefined

      const { app } = createApp({ appConfig, sttConfig, logger, tmpFilesFetcher })
      cachedApp = app
    }

    return cachedApp.fetch(request, env)
  },
}
