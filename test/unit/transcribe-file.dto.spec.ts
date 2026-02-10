import { createApp } from '../../src/app.js'
import { loadAppConfig } from '../../src/config/app.config.js'
import { loadSttConfig } from '../../src/config/stt.config.js'
import { createMockLogger } from '../helpers/mocks.js'

/**
 * Tests request validation in the Hono /transcribe endpoint
 * (replaces class-validator DTO tests)
 */
describe('Transcribe request validation', () => {
  function makeApp() {
    const appConfig = loadAppConfig({})
    const sttConfig = loadSttConfig({})
    const logger = createMockLogger()
    return createApp({ appConfig, sttConfig, logger }).app
  }

  it('validates a correct payload (returns non-400 for valid audioUrl)', async () => {
    const app = makeApp()
    const res = await app.request('/api/v1/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: 'https://example.com/a.mp3' }),
    })
    // Should not be a 400 validation error (may be 401/503 due to missing API key, which is fine)
    expect(res.status).not.toBe(400)
  })

  it('accepts optional restorePunctuation boolean', async () => {
    const app = makeApp()
    const res = await app.request('/api/v1/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: 'https://example.com/a.mp3', restorePunctuation: true }),
    })
    expect(res.status).not.toBe(400)
  })

  it('rejects invalid restorePunctuation type', async () => {
    const app = makeApp()
    const res = await app.request('/api/v1/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: 'https://example.com/a.mp3', restorePunctuation: 'yes' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('restorePunctuation')
  })

  it('accepts optional source language string', async () => {
    const app = makeApp()
    const res = await app.request('/api/v1/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: 'https://example.com/a.mp3', language: 'en-US' }),
    })
    expect(res.status).not.toBe(400)
  })

  it('rejects invalid language type', async () => {
    const app = makeApp()
    const res = await app.request('/api/v1/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: 'https://example.com/a.mp3', language: 123 }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('language')
  })

  it('rejects non-http url', async () => {
    const app = makeApp()
    const res = await app.request('/api/v1/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: 'ftp://example.com/a.mp3' }),
    })
    expect(res.status).toBe(400)
  })
})
