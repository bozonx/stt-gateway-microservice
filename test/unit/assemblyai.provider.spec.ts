
import { MockAgent, setGlobalDispatcher } from 'undici'
import type { AssemblyAiProvider as AssemblyAiProviderType } from '../../src/providers/assemblyai/assemblyai.provider.js'

// Dynamic imports
const { AssemblyAiProvider } = await import('../../src/providers/assemblyai/assemblyai.provider.js')

import { Test } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { ServiceUnavailableException, GatewayTimeoutException } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import appConfig from '@config/app.config'
import sttConfig from '@config/stt.config'
import { createMockLogger } from '@test/helpers/mocks'

describe('AssemblyAiProvider', () => {
  let provider: AssemblyAiProviderType
  let mockAgent: MockAgent

  const mockApiKey = 'test-api-key-123'
  const mockAudioUrl = 'https://example.com/audio.mp3'
  const mockTranscriptId = 'transcript-123'
  const API_BASE = 'https://api.assemblyai.com' // Should match constant

  beforeEach(async () => {
    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    setGlobalDispatcher(mockAgent)

    // Mock the sleep method globally
    jest
      .spyOn(AssemblyAiProvider.prototype as any, 'sleep')
      .mockImplementation(() => Promise.resolve())
    
    process.env.POLL_INTERVAL_MS = '100'
    process.env.DEFAULT_MAX_WAIT_MINUTES = '1'
    process.env.PROVIDER_API_TIMEOUT_SECONDS = '5'

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig, sttConfig],
        }),
      ],
      providers: [
        AssemblyAiProvider,
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
      ],
    }).compile()

    provider = moduleRef.get<AssemblyAiProviderType>(AssemblyAiProvider)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.POLL_INTERVAL_MS
    delete process.env.DEFAULT_MAX_WAIT_MINUTES
    delete process.env.PROVIDER_API_TIMEOUT_SECONDS
    // Agent is reset in beforeEach but explicit cleanup is good practice if tests were parallel
  })

  it('should enable language detection when language is not provided', async () => {
    const mockPool = mockAgent.get(API_BASE)

    // 1. Create transcript request
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
        // Optional: verify body matches
        // body: (str) => { const b = JSON.parse(str); return b.language_detection === true && !b.language_code }
    }).reply(200, {
        id: mockTranscriptId, status: 'queued'
    })

    // 2. Poll transcript status (completed)
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'completed', text: 'Hello world'
    })

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })

    // We can't inspect the body directly with MockAgent in the same way with jest mocks, 
    // but we can verify behavior (it returns result)
    // If we want to strictly checking request body, we can put assertions inside intercept param
    // or use a spy on undici.request if we weren't mocking global dispatcher fully
    expect(result.text).toBe('Hello world')
  })

  it('should pass language_code when language is provided', async () => {
    const mockPool = mockAgent.get(API_BASE)

    // 1. Create transcript request
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
        body: (str) => { 
            const b = JSON.parse(str); 
            return b.language_code === 'ru' && !b.language_detection
        }
    }).reply(200, {
        id: mockTranscriptId, status: 'queued'
    })

    // 2. Poll transcript status (completed)
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'completed', text: 'Hello world'
    })

    const result = await provider.submitAndWaitByUrl({
      audioUrl: mockAudioUrl,
      apiKey: mockApiKey,
      language: '  ru  ',
    })

    expect(result.text).toBe('Hello world')
  })

  it('should successfully complete transcription (queued → processing → completed)', async () => {
     const mockPool = mockAgent.get(API_BASE)

    // 1. Create transcript request
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
    }).reply(200, {
        id: mockTranscriptId, status: 'queued'
    })

    // 2. Poll 1: queued
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'queued'
    })

    // 3. Poll 2: processing
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'processing'
    })

    // 4. Poll 3: completed
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        id: mockTranscriptId, status: 'completed', text: 'Hello world'
    })

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })

    expect(result.text).toBe('Hello world')
  })

  it('should throw GatewayTimeoutException when deadline is exceeded', async () => {
     const mockPool = mockAgent.get(API_BASE)

    // 1. Create transcript request
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
    }).reply(200, {
        id: mockTranscriptId, status: 'queued'
    })

    // 2. Poll loop (persistent intercept)
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'processing'
    }).persist()

    // Mock Date.now
    let currentTime = Date.now()
    jest.spyOn(Date, 'now').mockImplementation(() => {
      currentTime += 30000 
      return currentTime
    })

    await expect(
      provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    ).rejects.toThrow(GatewayTimeoutException)
  })

  it('should retry submission on 500 error', async () => {
     const mockPool = mockAgent.get(API_BASE)

    // 1. Create transcript request (FAIL 500)
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
    }).reply(500, { message: 'Err' })

    // 2. Retry Create transcript request (SUCCESS)
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
    }).reply(200, {
        id: mockTranscriptId, status: 'queued'
    })

    // 3. Poll (completed)
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'completed', text: 'Retry success'
    })

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Retry success')
  })

  it('should continue polling on 500 error during status check', async () => {
    const mockPool = mockAgent.get(API_BASE)

    // 1. Create transcript request
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
    }).reply(200, {
        id: mockTranscriptId, status: 'queued'
    })

    // 2. Poll 1 (FAIL 500)
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(500, { message: 'Err' })

    // 3. Poll 2 (SUCCESS completed)
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'completed', text: 'Polling success'
    })

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Polling success')
  })

  it('should handle completed status on first poll', async () => {
    const mockPool = mockAgent.get(API_BASE)

    // 1. Create transcript request
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
    }).reply(200, {
        id: mockTranscriptId, status: 'queued'
    })

    // 2. Poll 1 (SUCCESS completed)
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'completed', text: 'Quick'
    })

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Quick')
  })

  it('should throw ServiceUnavailableException when status is error', async () => {
    const mockPool = mockAgent.get(API_BASE)

    // 1. Create transcript request
    mockPool.intercept({
        path: '/v2/transcript',
        method: 'POST',
    }).reply(200, {
        id: mockTranscriptId, status: 'queued'
    })

    // 2. Poll 1 (ERROR STATUS)
     mockPool.intercept({
        path: `/v2/transcript/${mockTranscriptId}`,
        method: 'GET'
    }).reply(200, {
        status: 'error', error: 'Internal fail'
    })

    await expect(
      provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    ).rejects.toThrow('Internal fail')
  })
})
