import { createTestApp } from './test-app.factory.js'

describe('Transcription Stream (e2e)', () => {
  it('POST /transcribe/stream should return 400 if not multipart', async () => {
    const app = createTestApp()
    const response = await app.request('/api/v1/transcribe/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toContain('multipart/form-data')
  })

  it('POST /transcribe/stream should return 400 if no file provided', async () => {
    const app = createTestApp()
    const form = new FormData()
    form.append('provider', 'assemblyai')

    const response = await app.request('/api/v1/transcribe/stream', {
      method: 'POST',
      body: form,
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toContain('file')
  })
})
