import { jest } from '@jest/globals'
import { createTestApp } from './test-app.factory.js'

const originalFetch = globalThis.fetch

describe('Transcription Stream (e2e)', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.ASSEMBLYAI_API_KEY
    delete process.env.TMP_FILES_BASE_URL
  })

  it('POST /transcribe/stream should return 400 if multipart', async () => {
    const app = createTestApp()

    const form = new FormData()
    form.append(
      'file',
      new File([new Blob(['abc'], { type: 'audio/mpeg' })], 'a.mp3', { type: 'audio/mpeg' })
    )

    const response = await app.request('/api/v1/transcribe/stream', {
      method: 'POST',
      headers: {
        'X-STT-Provider': 'assemblyai',
      },
      body: form,
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toContain('multipart')
  })

  it('POST /transcribe/stream should return 400 if no body provided', async () => {
    const app = createTestApp()

    const response = await app.request('/api/v1/transcribe/stream', {
      method: 'POST',
      headers: {
        'X-STT-Provider': 'assemblyai',
      },
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toContain('body')
  })

  it('POST /transcribe/stream returns 200 on happy path (mocks tmp-files + provider)', async () => {
    const transcriptId = 't-stream-1'

    globalThis.fetch = (jest.fn() as any).mockImplementation(async (...args: any[]) => {
      const urlStr = String(args[0])
      const init = args[1] as RequestInit | undefined
      const method = init?.method ?? 'GET'

      if (method === 'POST' && urlStr.includes('/files')) {
        return new Response(
          JSON.stringify({ downloadUrl: 'https://tmp-files.example/download/abc' }),
          {
            status: 201,
          }
        )
      }

      if (method === 'POST' && urlStr.includes('api.assemblyai.com')) {
        return new Response(JSON.stringify({ id: transcriptId, status: 'queued' }), { status: 200 })
      }

      if (method === 'GET' && urlStr.includes('api.assemblyai.com')) {
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

      return new Response(
        JSON.stringify({ message: 'Unexpected fetch call', url: urlStr, method }),
        {
          status: 500,
        }
      )
    }) as any

    process.env.ASSEMBLYAI_API_KEY = 'x'
    process.env.TMP_FILES_BASE_URL = 'https://tmp-files.example/api/v1'

    const app = createTestApp()

    const response = await app.request('/api/v1/transcribe/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-STT-Provider': 'assemblyai',
        'X-File-Name': 'a.mp3',
      },
      body: 'abc',
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.text).toBe('hello stream')
    expect(body.requestId).toBe(transcriptId)
  })

  it('POST /transcribe/stream returns 500 if tmp-files responds with invalid JSON', async () => {
    globalThis.fetch = (jest.fn() as any).mockImplementation(async (...args: any[]) => {
      const urlStr = String(args[0])
      const init = args[1] as RequestInit | undefined
      const method = init?.method ?? 'GET'

      if (method === 'POST' && urlStr.includes('/files')) {
        return new Response('not-json', {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({ message: 'Unexpected fetch call', url: urlStr, method }),
        {
          status: 500,
        }
      )
    }) as any

    process.env.ASSEMBLYAI_API_KEY = 'x'
    process.env.TMP_FILES_BASE_URL = 'https://tmp-files.example/api/v1'

    const app = createTestApp()

    const response = await app.request('/api/v1/transcribe/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-STT-Provider': 'assemblyai',
        'X-File-Name': 'a.mp3',
      },
      body: 'abc',
    })

    expect(response.status).toBe(500)
    const body = (await response.json()) as any
    expect(body.message).toContain('Invalid response from temporary storage')
  })

  it('POST /api/v1/transcribe/stream returns 499 when request is aborted during upload', async () => {
    // Mock tmp-files upload to hang
    globalThis.fetch = jest.fn().mockImplementation(async (url: any, init?: any) => {
      if (typeof url === 'string' && url.includes('/files')) {
        const signal = init?.signal as AbortSignal | undefined
        if (signal?.aborted) {
          throw new Error('aborted')
        }
        // Return a promise that never resolves manually, but respects signal
        return new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
      }
      return new Response(null, { status: 500 })
    }) as any

    const app = createTestApp()
    const ac = new AbortController()

    // Note: We need a way to trigger abort while the request is in progress
    const requestPromise = app.request('/api/v1/transcribe/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-STT-Provider': 'assemblyai',
        'X-File-Name': 'a.mp3',
        'X-STT-Api-Key': 'key',
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('some audio data'))
          // Don't close yet to keep it hanging
        },
      }),
      // @ts-expect-error duplex is required for streaming body in Node.js
      duplex: 'half',
      signal: ac.signal,
    })

    setTimeout(() => ac.abort(), 100)

    const response = await requestPromise
    expect(response.status).toBe(499)
    const body = (await response.json()) as any
    expect(body.error).toBe('ClientClosedRequestError')
  })
})
