import { createTestApp } from './test-app.factory.js'

const originalFetch = globalThis.fetch

describe('Transcription Stream (e2e)', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.ASSEMBLYAI_API_KEY
    delete process.env.TMP_FILES_BASE_URL
  })

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

  it('POST /transcribe/stream returns 200 on happy path (mocks tmp-files + provider)', async () => {
    const transcriptId = 't-stream-1'

    globalThis.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'

      if (method === 'POST' && typeof url === 'string' && url.includes('/files')) {
        return new Response(
          JSON.stringify({ downloadUrl: 'https://tmp-files.example/download/abc' }),
          {
            status: 201,
          }
        )
      }

      if (method === 'POST' && typeof url === 'string' && url.includes('api.assemblyai.com')) {
        return new Response(JSON.stringify({ id: transcriptId, status: 'queued' }), { status: 200 })
      }

      if (method === 'GET' && typeof url === 'string' && url.includes('api.assemblyai.com')) {
        return new Response(
          JSON.stringify({ id: transcriptId, status: 'completed', text: 'hello stream' }),
          {
            status: 200,
          }
        )
      }

      if (method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-length': '100' } })
      }

      return new Response(JSON.stringify({ message: 'Unexpected fetch call', url, method }), {
        status: 500,
      })
    }) as any

    process.env.ASSEMBLYAI_API_KEY = 'x'
    process.env.TMP_FILES_BASE_URL = 'https://tmp-files.example/api/v1'

    const app = createTestApp()
    const form = new FormData()
    form.append(
      'file',
      new File([new Blob(['abc'], { type: 'audio/mpeg' })], 'a.mp3', { type: 'audio/mpeg' })
    )
    form.append('provider', 'assemblyai')

    const response = await app.request('/api/v1/transcribe/stream', {
      method: 'POST',
      body: form,
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.text).toBe('hello stream')
    expect(body.requestId).toBe(transcriptId)
  })
})
