/**
 * Platform-agnostic logger interface
 * Implemented by Pino (Node.js) and console-based logger (Workers)
 */
export interface Logger {
  debug(msg: string): void
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
  error(obj: Record<string, unknown>, msg: string): void
}
