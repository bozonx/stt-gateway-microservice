import { Hono } from 'hono'
import { authMiddleware } from '../../../../src/common/middleware/auth.middleware.js'
import { UnauthorizedError } from '../../../../src/common/errors/http-error.js'

describe('authMiddleware', () => {
  it('should allow access if no tokens are configured', async () => {
    const app = new Hono()
    app.use('*', authMiddleware([]))
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('should allow access if a valid token is provided', async () => {
    const app = new Hono()
    app.use('*', authMiddleware(['valid-token']))
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('should allow access to public paths without a token', async () => {
    const app = new Hono()
    app.use('*', authMiddleware(['valid-token'], ['/health']))
    app.get('/health', (c) => c.text('ok'))

    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('should deny access if Authorization header is missing', async () => {
    const app = new Hono()
    // Mock error handler since Hono's default might not catch our custom error in test request
    app.onError((err, c) => {
      if (err instanceof UnauthorizedError) {
        return c.text(err.message, 401)
      }
      return c.text('error', 500)
    })
    app.use('*', authMiddleware(['valid-token']))
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test')
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authorization header is missing')
  })

  it('should deny access if token is invalid', async () => {
    const app = new Hono()
    app.onError((err, c) => {
      if (err instanceof UnauthorizedError) {
        return c.text(err.message, 401)
      }
      return c.text('error', 500)
    })
    app.use('*', authMiddleware(['valid-token']))
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test', {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    })
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Invalid bearer token')
  })

  it('should deny access if authorization format is invalid', async () => {
    const app = new Hono()
    app.onError((err, c) => {
      if (err instanceof UnauthorizedError) {
        return c.text(err.message, 401)
      }
      return c.text('error', 500)
    })
    app.use('*', authMiddleware(['valid-token']))
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test', {
      headers: {
        Authorization: 'Basic restricted',
      },
    })
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Invalid authorization format. Expected Bearer <token>')
  })
})
