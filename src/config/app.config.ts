/**
 * Platform-agnostic application configuration
 * Works with process.env (Node.js) and env bindings (Cloudflare Workers)
 */

export interface AppConfig {
  port: number
  host: string
  basePath: string
  nodeEnv: string
  logLevel: string
}

const VALID_ENVS = ['development', 'production', 'test']
const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']

export function loadAppConfig(env: Record<string, string | undefined>): AppConfig {
  const port = parseInt(env.LISTEN_PORT ?? '8080', 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('App config validation error: LISTEN_PORT must be between 1 and 65535')
  }

  const nodeEnv = env.NODE_ENV ?? 'production'
  if (!VALID_ENVS.includes(nodeEnv)) {
    throw new Error(`App config validation error: NODE_ENV must be one of ${VALID_ENVS.join(', ')}`)
  }

  const logLevel = env.LOG_LEVEL ?? 'warn'
  if (!VALID_LOG_LEVELS.includes(logLevel)) {
    throw new Error(
      `App config validation error: LOG_LEVEL must be one of ${VALID_LOG_LEVELS.join(', ')}`
    )
  }

  return {
    port,
    host: env.LISTEN_HOST ?? '0.0.0.0',
    basePath: (env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, ''),
    nodeEnv,
    logLevel,
  }
}
