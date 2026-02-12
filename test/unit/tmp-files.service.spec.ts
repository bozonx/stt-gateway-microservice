import { jest } from '@jest/globals'
import { TmpFilesService } from '../../src/modules/transcription/tmp-files.service.js'
import {
  BadRequestError,
  InternalServerError,
  ClientClosedRequestError,
} from '../../src/common/errors/http-error.js'
import { createMockLogger } from '../helpers/mocks.js'

// Save original fetch
const originalFetch = globalThis.fetch

describe('TmpFilesService', () => {
  let service: TmpFilesService

  const mockCfg = {
    tmpFilesBaseUrl: 'http://tmp-files-mock',
    tmpFilesDefaultTtlMins: 30,
    defaultProvider: 'assemblyai',
    maxFileMb: 100,
    providerApiTimeoutSeconds: 15,
    pollIntervalMs: 1500,
    defaultMaxWaitMinutes: 3,
    maxRetries: 3,
    retryDelayMs: 1500,
  }

  beforeEach(() => {
    const logger = createMockLogger()
    service = new TmpFilesService(mockCfg, logger)
  })

  function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, p) => sum + p.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const p of parts) {
      out.set(p, offset)
      offset += p.length
    }
    return out
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should successfully upload a file and return the download URL', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ downloadUrl: '/api/v1/download/uuid-123' }), {
        status: 201,
      })
    }) as any as any

    const file = new Blob(['test audio data'], { type: 'audio/mpeg' })
    const result = await service.uploadFile(file, 'test.mp3', 'audio/mpeg')

    expect(result).toBe('http://tmp-files-mock/api/v1/download/uuid-123')
  })

  describe('uploadStream', () => {
    it('should stream file to tmp-files and return the download URL', async () => {
      const fetchMock = jest.fn(async () => {
        return new Response(JSON.stringify({ downloadUrl: '/api/v1/download/stream-123' }), {
          status: 201,
        })
      }) as any as any
      globalThis.fetch = fetchMock

      const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk)
          controller.close()
        },
      })

      const result = await service.uploadStream(stream, 'test.mp3', 'audio/mpeg')

      expect(result).toBe('http://tmp-files-mock/api/v1/download/stream-123')
      expect(fetchMock).toHaveBeenCalledWith(
        'http://tmp-files-mock/files',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'audio/mpeg',
            'X-File-Name': 'test.mp3',
            'X-Ttl-Mins': '30',
          }),
        })
      )
    })

    it('should forward raw stream bytes without multipart framing', async () => {
      let capturedBody: ReadableStream<Uint8Array> | null = null
      const fetchMock = jest.fn().mockImplementation(async (...args: any[]) => {
        const init = args[1] as RequestInit | undefined
        capturedBody = init?.body as ReadableStream<Uint8Array>

        const reader = capturedBody.getReader()
        const parts: Uint8Array[] = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          parts.push(value)
        }

        const text = new TextDecoder().decode(concatUint8Arrays(parts))
        expect(text).toBe('audio-data')

        expect(init?.headers).toEqual(
          expect.objectContaining({
            'Content-Type': 'audio/wav',
            'X-File-Name': 'audio.wav',
            'X-Ttl-Mins': '30',
          })
        )

        return new Response(JSON.stringify({ downloadUrl: '/download/x' }), { status: 201 })
      }) as any
      globalThis.fetch = fetchMock

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('audio-data'))
          controller.close()
        },
      })

      await service.uploadStream(stream, 'audio.wav', 'audio/wav')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should send Content-Length header when contentLengthBytes is provided', async () => {
      const fetchMock = jest.fn(async () => {
        return new Response(JSON.stringify({ downloadUrl: '/download/y' }), { status: 201 })
      }) as any as any
      globalThis.fetch = fetchMock

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      await service.uploadStream(stream, 'a.bin', 'application/octet-stream', 3)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Length': '3',
          }),
        })
      )
    })

    it('should include Authorization header when tmpFilesBearerToken is set', async () => {
      const token = 'stream-token'
      const serviceWithAuth = new TmpFilesService(
        { ...mockCfg, tmpFilesBearerToken: token },
        createMockLogger()
      )

      const fetchMock = jest.fn(async () => {
        return new Response(JSON.stringify({ downloadUrl: '/file' }), { status: 201 })
      }) as any as any
      globalThis.fetch = fetchMock

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        },
      })

      await serviceWithAuth.uploadStream(stream, 'test.mp3', 'audio/mpeg')

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      )
    })

    it('should return full URL when tmp-files returns absolute downloadUrl', async () => {
      const fullUrl = 'https://cdn.example.com/file/abc'
      globalThis.fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ downloadUrl: fullUrl }), { status: 201 })
      }) as any as any

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        },
      })

      const result = await service.uploadStream(stream, 'test.mp3', 'audio/mpeg')
      expect(result).toBe(fullUrl)
    })

    it('should throw BadRequestError when tmp-files returns 413', async () => {
      globalThis.fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ message: 'Payload Too Large' }), { status: 413 })
      }) as any as any

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        },
      })

      await expect(service.uploadStream(stream, 'large.mp3', 'audio/mpeg')).rejects.toThrow(
        BadRequestError
      )
    })

    it('should throw InternalServerError for server errors', async () => {
      globalThis.fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ message: 'Internal Error' }), { status: 500 })
      }) as any as any

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        },
      })

      await expect(service.uploadStream(stream, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
        InternalServerError
      )
    })

    it('should throw ClientClosedRequestError when aborted', async () => {
      globalThis.fetch = jest.fn(async () => {
        throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })
      }) as any as any

      const abortController = new AbortController()
      abortController.abort()

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        },
      })

      await expect(
        service.uploadStream(stream, 'test.mp3', 'audio/mpeg', undefined, abortController.signal)
      ).rejects.toThrow(ClientClosedRequestError)
    })
  })

  it('should return the full download URL if the service returns a full URL', async () => {
    const fullUrl = 'https://external-storage.com/file/uuid-456'

    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ downloadUrl: fullUrl }), { status: 201 })
    }) as any as any

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    const result = await service.uploadFile(file, 'test.mp3', 'audio/mpeg')

    expect(result).toBe(fullUrl)
  })

  it('should include Authorization header if tmpFilesBearerToken is provided', async () => {
    const token = 'test-token'
    const serviceWithAuth = new TmpFilesService(
      { ...mockCfg, tmpFilesBearerToken: token },
      createMockLogger()
    )

    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ downloadUrl: '/file' }), { status: 201 })
    }) as any as any
    globalThis.fetch = fetchMock

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    await serviceWithAuth.uploadFile(file, 'test.mp3', 'audio/mpeg')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/files'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
        }),
      })
    )
  })

  it('should throw BadRequestError when tmp-files returns 413', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ message: 'Payload Too Large' }), { status: 413 })
    }) as any as any

    const file = new Blob(['large file'], { type: 'audio/mpeg' })
    await expect(service.uploadFile(file, 'large.mp3', 'audio/mpeg')).rejects.toThrow(
      BadRequestError
    )
  })

  it('should throw InternalServerError for other errors', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ message: 'Internal Error' }), { status: 500 })
    }) as any as any

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    await expect(service.uploadFile(file, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
      InternalServerError
    )
  })

  it('should throw InternalServerError if downloadUrl is missing in response', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({}), { status: 201 })
    }) as any as any

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    await expect(service.uploadFile(file, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
      InternalServerError
    )
  })

  it('should throw ClientClosedRequestError when request is aborted', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })
    }) as any as any

    const abortController = new AbortController()
    abortController.abort()

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    await expect(
      service.uploadFile(file, 'test.mp3', 'audio/mpeg', abortController.signal)
    ).rejects.toThrow(ClientClosedRequestError)
  })
})
