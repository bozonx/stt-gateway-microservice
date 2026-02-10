import { createApp } from '../../src/app.js'
import { loadAppConfig } from '../../src/config/app.config.js'
import { loadSttConfig } from '../../src/config/stt.config.js'
import { createMockLogger } from '../helpers/mocks.js'

describe('Health endpoint (unit)', () => {
  it('GET /api/v1/health returns ok', async () => {
    const appConfig = loadAppConfig({})
    const sttConfig = loadSttConfig({})
    const logger = createMockLogger()
    const { app } = createApp({ appConfig, sttConfig, logger })

    const res = await app.request('/api/v1/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })
})
