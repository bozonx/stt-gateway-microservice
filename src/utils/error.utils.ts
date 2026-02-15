/**
 * Utility functions for error handling
 */

/**
 * Checks if the given error is an AbortError (from fetch or AbortController)
 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const err = error as { name?: unknown; code?: unknown; message?: unknown }
  const name = typeof err.name === 'string' ? err.name : undefined
  const code = typeof err.code === 'string' ? err.code : undefined
  const message = typeof err.message === 'string' ? err.message : undefined

  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    code === 'UND_ERR_ABORTED' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    message === 'The operation was aborted' ||
    message === 'This operation was aborted' ||
    message?.includes('aborted') === true
  )
}
