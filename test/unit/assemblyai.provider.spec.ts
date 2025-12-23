import { Test } from '@nestjs/testing'
import { HttpModule, HttpService } from '@nestjs/axios'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { of } from 'rxjs'
import { ServiceUnavailableException, GatewayTimeoutException } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { AssemblyAiProvider } from '@/providers/assemblyai/assemblyai.provider'
import appConfig from '@config/app.config'
import sttConfig from '@config/stt.config'
import { createMockLogger } from '@test/helpers/mocks'

describe('AssemblyAiProvider', () => {
  let provider: AssemblyAiProvider
  let httpService: HttpService

  const mockApiKey = 'test-api-key-123'
  const mockAudioUrl = 'https://example.com/audio.mp3'
  const mockTranscriptId = 'transcript-123'

  beforeEach(async () => {
    // Mock the sleep method globally for THIS provider instance to avoid real delays
    // This is better than fake timers in complex NestJS/RxJS environments
    jest.spyOn(AssemblyAiProvider.prototype as any, 'sleep').mockImplementation(() => Promise.resolve())

    process.env.POLL_INTERVAL_MS = '100'
    process.env.DEFAULT_MAX_WAIT_MINUTES = '1'
    process.env.PROVIDER_API_TIMEOUT_SECONDS = '5'

    const moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
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

    provider = moduleRef.get<AssemblyAiProvider>(AssemblyAiProvider)
    httpService = moduleRef.get<HttpService>(HttpService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.POLL_INTERVAL_MS
    delete process.env.DEFAULT_MAX_WAIT_MINUTES
    delete process.env.PROVIDER_API_TIMEOUT_SECONDS
  })

  it('should successfully complete transcription (queued → processing → completed)', async () => {
    const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
    const queuedResponse = { status: 200, data: { status: 'queued' } }
    const processingResponse = { status: 200, data: { status: 'processing' } }
    const completedResponse = {
      status: 200,
      data: { id: mockTranscriptId, status: 'completed', text: 'Hello world' },
    }

    jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
    jest.spyOn(httpService, 'get')
      .mockReturnValueOnce(of(queuedResponse as any))
      .mockReturnValueOnce(of(processingResponse as any))
      .mockReturnValueOnce(of(completedResponse as any))

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })

    expect(result.text).toBe('Hello world')
    expect(httpService.get).toHaveBeenCalledTimes(3)
  })

  it('should throw GatewayTimeoutException when deadline is exceeded', async () => {
    const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
    const processingResponse = { status: 200, data: { status: 'processing' } }

    jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
    jest.spyOn(httpService, 'get').mockReturnValue(of(processingResponse as any))

    // Mock Date.now to simulate time passing
    let currentTime = Date.now()
    jest.spyOn(Date, 'now').mockImplementation(() => {
      currentTime += 30000 // jump 30s on each call
      return currentTime
    })

    await expect(provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey }))
      .rejects.toThrow(GatewayTimeoutException)
  })

  it('should retry submission on 500 error', async () => {
    const errorResponse = { status: 500, data: { message: 'Err' } }
    const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
    const completedResponse = { status: 200, data: { status: 'completed', text: 'Retry success' } }

    jest.spyOn(httpService, 'post')
      .mockReturnValueOnce(of(errorResponse as any))
      .mockReturnValueOnce(of(createResponse as any))
    jest.spyOn(httpService, 'get').mockReturnValueOnce(of(completedResponse as any))

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Retry success')
    expect(httpService.post).toHaveBeenCalledTimes(2)
  })

  it('should continue polling on 500 error during status check', async () => {
    const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
    const errorResponse = { status: 500, data: { message: 'Err' } }
    const completedResponse = { status: 200, data: { status: 'completed', text: 'Polling success' } }

    jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
    jest.spyOn(httpService, 'get')
      .mockReturnValueOnce(of(errorResponse as any))
      .mockReturnValueOnce(of(completedResponse as any))

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Polling success')
    expect(httpService.get).toHaveBeenCalledTimes(2)
  })

  it('should handle completed status on first poll', async () => {
    const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
    const completedResponse = { status: 200, data: { status: 'completed', text: 'Quick' } }

    jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
    jest.spyOn(httpService, 'get').mockReturnValueOnce(of(completedResponse as any))

    const result = await provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
    expect(result.text).toBe('Quick')
  })

  it('should throw ServiceUnavailableException when status is error', async () => {
    const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
    const errorResponse = { status: 200, data: { status: 'error', error: 'Internal fail' } }

    jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
    jest.spyOn(httpService, 'get').mockReturnValueOnce(of(errorResponse as any))

    await expect(provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey }))
      .rejects.toThrow('Internal fail')
  })
})
