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

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should successfully upload a file and return the download URL', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ downloadUrl: '/api/v1/download/uuid-123' }), { status: 201 })
      ) as any

    const file = new Blob(['test audio data'], { type: 'audio/mpeg' })
    const result = await service.uploadFile(file, 'test.mp3', 'audio/mpeg')

    expect(result).toBe('http://tmp-files-mock/api/v1/download/uuid-123')
  })

  it('should return the full download URL if the service returns a full URL', async () => {
    const fullUrl = 'https://external-storage.com/file/uuid-456'

    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ downloadUrl: fullUrl }), { status: 201 })
      ) as any

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    const result = await service.uploadFile(file, 'test.mp3', 'audio/mpeg')

    expect(result).toBe(fullUrl)
  })

  it('should include Authorization header if tmpFilesBearerToken is provided', async () => {
    const token = 'test-token'
    const serviceWithAuth = new TmpFilesService({ ...mockCfg, tmpFilesBearerToken: token }, createMockLogger())
    
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ downloadUrl: '/file' }), { status: 201 })
    ) as any
    globalThis.fetch = fetchMock

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    await serviceWithAuth.uploadFile(file, 'test.mp3', 'audio/mpeg')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/files'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`
        })
      })
    )
  })

  it('should throw BadRequestError when tmp-files returns 413', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Payload Too Large' }), { status: 413 })
      ) as any

    const file = new Blob(['large file'], { type: 'audio/mpeg' })
    await expect(service.uploadFile(file, 'large.mp3', 'audio/mpeg')).rejects.toThrow(
      BadRequestError
    )
  })

  it('should throw InternalServerError for other errors', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Internal Error' }), { status: 500 })
      ) as any

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    await expect(service.uploadFile(file, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
      InternalServerError
    )
  })

  it('should throw InternalServerError if downloadUrl is missing in response', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 201 })) as any

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    await expect(service.uploadFile(file, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
      InternalServerError
    )
  })

  it('should throw ClientClosedRequestError when request is aborted', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })
      ) as any

    const abortController = new AbortController()
    abortController.abort()

    const file = new Blob(['test'], { type: 'audio/mpeg' })
    await expect(
      service.uploadFile(file, 'test.mp3', 'audio/mpeg', abortController.signal)
    ).rejects.toThrow(ClientClosedRequestError)
  })
})
