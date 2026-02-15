import { jest } from '@jest/globals'
import { AssemblyAiProvider } from '../../src/providers/assemblyai/assemblyai.provider.js'
import { loadSttConfig } from '../../src/config/stt.config.js'
import { GatewayTimeoutError, ServiceUnavailableError } from '../../src/common/errors/http-error.js'
import { createMockLogger } from '../helpers/mocks.js'

// Save original fetch
const originalFetch = globalThis.fetch

describe('AssemblyAiProvider', () => {
  let provider: AssemblyAiProvider

  const mockApiKey = 'test-api-key-123'
  const mockAudioUrl = 'https://example.com/audio.mp3'
  const mockTranscriptId = 'transcript-123'
  const API_BASE = 'https://api.assemblyai.com/v2/transcript'

  // Queue of mock responses for fetch
  let fetchResponses: Array<{ status: number; body: unknown }>

  beforeEach(() => {
    fetchResponses = []

    // Mock the sleep method to avoid real delays
    jest
      .spyOn(AssemblyAiProvider.prototype as any, 'sleep')
      .mockImplementation(() => Promise.resolve())

    process.env.POLL_INTERVAL_MS = '100'
    process.env.DEFAULT_MAX_WAIT_MINUTES = '1'
    process.env.PROVIDER_API_TIMEOUT_SECONDS = '5'

    const cfg = loadSttConfig(process.env as Record<string, string | undefined>)
    const logger = createMockLogger()
    provider = new AssemblyAiProvider(cfg, logger)

    // Mock global fetch to return queued responses
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      const next = fetchResponses.shift()
      if (!next) {
        return new Response(JSON.stringify({ status: 'processing' }), { status: 200 })
      }
      return new Response(JSON.stringify(next.body), { status: next.status })
    }) as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
    globalThis.fetch = originalFetch
    delete process.env.POLL_INTERVAL_MS
    delete process.env.DEFAULT_MAX_WAIT_MINUTES
    delete process.env.PROVIDER_API_TIMEOUT_SECONDS
  })

  it('should enable language detection when language is not provided', async () => {
    fetchResponses = [
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      { status: 200, body: { status: 'completed', text: 'Hello world' } },
    ]

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Hello world')

    // Verify the POST body contained language_detection
    const fetchMock = globalThis.fetch as jest.Mock
    const firstCall = fetchMock.mock.calls[0] as any[]
    const body = JSON.parse(firstCall[1].body)
    expect(body.language_detection).toBe(true)
    expect(body.language_code).toBeUndefined()
  })

  it('should pass language_code when language is provided', async () => {
    fetchResponses = [
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      { status: 200, body: { status: 'completed', text: 'Hello world' } },
    ]

    const result = await provider.submitAndWaitByUrl({
      audioUrl: mockAudioUrl,
      apiKey: mockApiKey,
      language: '  ru  ',
    })

    expect(result.text).toBe('Hello world')

    const fetchMock = globalThis.fetch as jest.Mock
    const firstCall = fetchMock.mock.calls[0] as any[]
    const body = JSON.parse(firstCall[1].body)
    expect(body.language_code).toBe('ru')
    expect(body.language_detection).toBeUndefined()
  })

  it('should pass speech_models when models are provided', async () => {
    fetchResponses = [
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      { status: 200, body: { status: 'completed', text: 'Hello world' } },
    ]

    const result = await provider.submitAndWaitByUrl({
      audioUrl: mockAudioUrl,
      apiKey: mockApiKey,
      models: ['universal-3-pro', 'universal-2'],
    })

    expect(result.text).toBe('Hello world')

    const fetchMock = globalThis.fetch as jest.Mock
    const firstCall = fetchMock.mock.calls[0] as any[]
    const body = JSON.parse(firstCall[1].body)
    expect(body.speech_models).toEqual(['universal-3-pro', 'universal-2'])
  })

  it('should successfully complete transcription (queued → processing → completed)', async () => {
    fetchResponses = [
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      { status: 200, body: { status: 'queued' } },
      { status: 200, body: { status: 'processing' } },
      { status: 200, body: { id: mockTranscriptId, status: 'completed', text: 'Hello world' } },
    ]

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Hello world')
  })

  it('should throw GatewayTimeoutError when deadline is exceeded', async () => {
    fetchResponses = [{ status: 200, body: { id: mockTranscriptId, status: 'queued' } }]
    // All subsequent polls return processing (default in mock)

    let currentTime = Date.now()
    jest.spyOn(Date, 'now').mockImplementation(() => {
      currentTime += 30000
      return currentTime
    })

    await expect(
      provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    ).rejects.toThrow(GatewayTimeoutError)
  })

  it('should retry submission on 500 error', async () => {
    fetchResponses = [
      { status: 500, body: { message: 'Err' } },
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      { status: 200, body: { status: 'completed', text: 'Retry success' } },
    ]

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Retry success')
  })

  it('should continue polling on 500 error during status check', async () => {
    fetchResponses = [
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      { status: 500, body: { message: 'Err' } },
      { status: 200, body: { status: 'completed', text: 'Polling success' } },
    ]

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Polling success')
  })

  it('should handle completed status on first poll', async () => {
    fetchResponses = [
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      { status: 200, body: { status: 'completed', text: 'Quick' } },
    ]

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Quick')
  })

  it('should return word timings only when includeWords=true', async () => {
    fetchResponses = [
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      {
        status: 200,
        body: {
          status: 'completed',
          text: 'Hello world',
          words: [
            { text: 'Hello', start: 10, end: 100, confidence: 0.9 },
            { text: 'world', start: 120, end: 200, confidence: 0.8 },
          ],
        },
      },
    ]

    const noWords = await provider.submitAndWaitByUrl({
      audioUrl: mockAudioUrl,
      apiKey: mockApiKey,
    })
    expect(noWords.words).toBeUndefined()

    fetchResponses = [
      { status: 200, body: { id: mockTranscriptId, status: 'queued' } },
      {
        status: 200,
        body: {
          status: 'completed',
          text: 'Hello world',
          words: [
            { text: 'Hello', start: 10, end: 100, confidence: 0.9 },
            { text: 'world', start: 120, end: 200, confidence: 0.8 },
          ],
        },
      },
    ]

    const withWords = await provider.submitAndWaitByUrl({
      audioUrl: mockAudioUrl,
      apiKey: mockApiKey,
      includeWords: true,
    })

    expect(withWords.words).toEqual([
      { text: 'Hello', start: 10, end: 100, confidence: 0.9 },
      { text: 'world', start: 120, end: 200, confidence: 0.8 },
    ])
  })

  it('should throw ClientClosedRequestError when aborted during polling', async () => {
    fetchResponses = [{ status: 200, body: { id: mockTranscriptId, status: 'queued' } }]

    const ac = new AbortController()

    // Mock sleep to abort the signal after the first "sleep" call (before next poll)
    let sleepCount = 0
    jest.spyOn(AssemblyAiProvider.prototype as any, 'sleep').mockImplementation(async () => {
      sleepCount++
      if (sleepCount === 1) {
        ac.abort()
      }
      return Promise.resolve()
    })

    await expect(
      provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey, signal: ac.signal })
    ).rejects.toThrow('CLIENT_CLOSED_REQUEST')
  })
})
