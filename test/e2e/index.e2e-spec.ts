import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from './test-app.factory'

describe('Index (e2e)', () => {
  let app: NestFastifyApplication

  beforeEach(async () => {
    app = await createTestApp()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('GET /api/v1 returns 404 when index endpoint is removed', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1' })
    expect(response.statusCode).toBe(404)
  })
})
