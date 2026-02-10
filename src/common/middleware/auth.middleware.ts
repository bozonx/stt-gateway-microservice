import type { MiddlewareHandler } from 'hono'
import { UnauthorizedError } from '../errors/http-error.js'

/**
 * Creates a middleware that validates Bearer tokens if they are configured.
 * 
 * @param allowedTokens - List of valid Bearer tokens. If empty, auth is bypassed.
 * @param publicPaths - List of paths that don't require authentication.
 */
export function authMiddleware(
  allowedTokens: string[],
  publicPaths: string[] = []
): MiddlewareHandler {
  return async (c, next) => {
    // If no tokens are configured, auth is disabled
    if (allowedTokens.length === 0) {
      return next()
    }

    const { pathname } = new URL(c.req.url)
    
    // Check if the current path is public
    const isPublic = publicPaths.some((path) => {
      // Simple prefix match (e.g., /health)
      return pathname === path || pathname.startsWith(`${path}/`)
    })

    if (isPublic) {
      return next()
    }

    const authHeader = c.req.header('Authorization')
    if (!authHeader) {
      throw new UnauthorizedError('Authorization header is missing')
    }

    const [type, token] = authHeader.split(' ')
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedError('Invalid authorization format. Expected Bearer <token>')
    }

    if (!allowedTokens.includes(token)) {
      throw new UnauthorizedError('Invalid bearer token')
    }

    await next()
  }
}
