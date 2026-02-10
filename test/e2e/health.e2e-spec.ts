import { createTestApp } from './test-app.factory.js'

describe('Health (e2e)', () => {
  describe('GET /api/v1/health', () => {
    it('returns simple ok status', async () => {
      const app = createTestApp()
      const response = await app.request('/api/v1/health')

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ status: 'ok' })
    })
  })
})
