import { createTestApp } from './test-app.factory.js'

describe('Index (e2e)', () => {
  it('GET /api/v1 returns 404 when index endpoint is removed', async () => {
    const app = createTestApp()
    const response = await app.request('/api/v1')
    expect(response.status).toBe(404)
  })
})
