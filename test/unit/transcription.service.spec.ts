import { jest } from '@jest/globals'
import { TranscriptionService } from '../../src/modules/transcription/transcription.service.js'
import { SttProviderRegistry } from '../../src/providers/stt-provider.registry.js'
import { loadSttConfig } from '../../src/config/stt.config.js'
import { createMockLogger } from '../helpers/mocks.js'

// Mock fetch globally for HEAD size checks
const originalFetch = globalThis.fetch

describe('TranscriptionService', () => {
  let sttConfig: ReturnType<typeof loadSttConfig>

  beforeEach(() => {
    process.env.ASSEMBLYAI_API_KEY = 'x'
    sttConfig = loadSttConfig(process.env as Record<string, string | undefined>)

    // Mock fetch for HEAD requests (size check)
    globalThis.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-length': '100' } })
      }
      return originalFetch(url, init as any)
    }) as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.ASSEMBLYAI_API_KEY
  })

  function createService(mockProvider: any) {
    const logger = createMockLogger()
    const registry = {
      get: jest.fn().mockReturnValue(mockProvider),
    } as unknown as SttProviderRegistry
    return new TranscriptionService(registry, sttConfig, logger)
  }

  function createMockProvider(overrides?: Partial<any>) {
    return {
      capabilities: {
        restorePunctuation: true,
        formatText: true,
        models: true,
        wordTimings: true,
      },
      submitAndWaitByUrl: jest.fn<(...args: any[]) => Promise<any>>(),
      ...overrides,
    }
  }

  it('rejects private host url', async () => {
    const mockProvider = createMockProvider()
    const svc = createService(mockProvider)
    await expect(svc.transcribeByUrl({ audioUrl: 'http://localhost:8000/a.mp3' })).rejects.toThrow()
  })

  it('returns response shape on success', async () => {
    const mockProvider = createMockProvider({
      submitAndWaitByUrl: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        text: 'hello',
        requestId: 'id1',
        durationSec: 1,
        language: 'en',
        confidenceAvg: 0.9,
        words: [{ start: 0, end: 100, text: 'hello' }],
      }),
    })

    const svc = createService(mockProvider)
    const res = await svc.transcribeByUrl({ audioUrl: 'https://example.com/a.mp3' })
    expect(res.text).toBe('hello')
    expect(res.provider).toBe('assemblyai')
    expect(res.requestId).toBe('id1')
    expect(res.wordsCount).toBe(1)
    expect(res.words).toBeUndefined()
    expect(res.punctuationRestored).toBe(true)
  })

  it('returns words when includeWords=true', async () => {
    const mockProvider = createMockProvider({
      submitAndWaitByUrl: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        text: 'hello',
        requestId: 'id1',
        words: [{ start: 0, end: 100, text: 'hello' }],
        punctuationRestored: true,
        raw: {},
      }),
    })

    const svc = createService(mockProvider)
    const res = await svc.transcribeByUrl({
      audioUrl: 'https://example.com/a.mp3',
      includeWords: true,
    })

    expect(res.words).toEqual([{ start: 0, end: 100, text: 'hello' }])
    expect(mockProvider.submitAndWaitByUrl).toHaveBeenCalledWith(
      expect.objectContaining({ includeWords: true })
    )
  })

  it('trims language before forwarding to provider', async () => {
    const mockProvider = createMockProvider({
      submitAndWaitByUrl: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        text: 'ok',
        requestId: 'id2',
        punctuationRestored: true,
      }),
    })

    const svc = createService(mockProvider)
    await svc.transcribeByUrl({
      audioUrl: 'https://example.com/a.mp3',
      provider: 'assemblyai',
      language: '  en  ',
    })

    expect(mockProvider.submitAndWaitByUrl).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' })
    )
  })

  it('forwards AbortSignal to provider', async () => {
    const mockProvider = createMockProvider({
      submitAndWaitByUrl: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        text: 'ok',
        requestId: 'id3',
        punctuationRestored: true,
      }),
    })

    const svc = createService(mockProvider)
    const ac = new AbortController()

    await svc.transcribeByUrl({
      audioUrl: 'https://example.com/a.mp3',
      signal: ac.signal,
    })

    expect(mockProvider.submitAndWaitByUrl).toHaveBeenCalledWith(
      expect.objectContaining({ signal: ac.signal })
    )
  })

  it('forwards models to provider', async () => {
    const mockProvider = createMockProvider({
      submitAndWaitByUrl: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        text: 'ok',
        requestId: 'id4',
        punctuationRestored: true,
      }),
    })

    const svc = createService(mockProvider)
    await svc.transcribeByUrl({
      audioUrl: 'https://example.com/a.mp3',
      models: ['universal-3-pro', 'universal-2'],
    })

    expect(mockProvider.submitAndWaitByUrl).toHaveBeenCalledWith(
      expect.objectContaining({ models: ['universal-3-pro', 'universal-2'] })
    )
  })

  it('rejects unsupported options for provider', async () => {
    const mockProvider = createMockProvider({
      capabilities: {
        restorePunctuation: false,
        formatText: true,
        models: false,
        wordTimings: false,
      },
      submitAndWaitByUrl: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        text: 'ok',
        requestId: 'id5',
        punctuationRestored: true,
        raw: {},
      }),
    })

    const svc = createService(mockProvider)

    await expect(
      svc.transcribeByUrl({
        audioUrl: 'https://example.com/a.mp3',
        restorePunctuation: true,
        models: ['universal-3-pro'],
      })
    ).rejects.toThrow("Unsupported options for provider 'assemblyai': restorePunctuation, models")
  })

  it('rejects includeWords when provider does not support wordTimings', async () => {
    const mockProvider = createMockProvider({
      capabilities: {
        restorePunctuation: true,
        formatText: true,
        models: true,
        wordTimings: false,
      },
      submitAndWaitByUrl: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        text: 'ok',
        requestId: 'id6',
        punctuationRestored: true,
        raw: {},
      }),
    })

    const svc = createService(mockProvider)

    await expect(
      svc.transcribeByUrl({
        audioUrl: 'https://example.com/a.mp3',
        includeWords: true,
      })
    ).rejects.toThrow("Unsupported options for provider 'assemblyai': includeWords")
  })
})
