import { createTestApp } from './test-app.factory.js'

const originalFetch = globalThis.fetch

describe('Transcribe (e2e)', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.ASSEMBLYAI_API_KEY
  })

  it('POST /api/v1/transcribe returns 200 on happy path (mocks provider HTTP)', async () => {
    const transcriptId = 't-123'

    globalThis.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'

      if (method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-length': '100' } })
      }

      if (method === 'POST' && typeof url === 'string' && url.includes('api.assemblyai.com')) {
        const body = JSON.parse(init?.body as string)
        expect(body.speech_models).toEqual(['universal-3-pro', 'universal-2'])
        return new Response(JSON.stringify({ id: transcriptId, status: 'queued' }), { status: 200 })
      }

      if (method === 'GET' && typeof url === 'string' && url.includes('api.assemblyai.com')) {
        return new Response(
          JSON.stringify({ id: transcriptId, status: 'completed', text: 'hello' }),
          {
            status: 200,
          }
        )
      }

      return new Response(JSON.stringify({ message: 'Unexpected fetch call', url, method }), {
        status: 500,
      })
    }) as any

    process.env.ASSEMBLYAI_API_KEY = 'x'
    const app = createTestApp()

    const response = await app.request('/api/v1/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: 'https://example.com/a.mp3',
        provider: 'assemblyai',
        models: ['universal-3-pro', 'universal-2'],
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.text).toBe('hello')
    expect(body.provider).toBe('assemblyai')
    expect(body.requestId).toBe(transcriptId)
  })

  it('POST /api/v1/transcribe returns 400 for invalid JSON', async () => {
    const app = createTestApp()
    const response = await app.request('/api/v1/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as any
    expect(body.message).toContain('Invalid JSON')
  })
})
