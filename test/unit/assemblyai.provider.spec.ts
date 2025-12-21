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
  let configService: ConfigService

  const mockApiKey = 'test-api-key-123'
  const mockAudioUrl = 'https://example.com/audio.mp3'
  const mockTranscriptId = 'transcript-123'

  beforeEach(async () => {
    process.env.STT_POLL_INTERVAL_MS = '100' // Speed up tests
    process.env.STT_MAX_SYNC_WAIT_MINUTES = '1' // 1 minute minimum
    process.env.STT_REQUEST_TIMEOUT_SECONDS = '5'

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
    configService = moduleRef.get<ConfigService>(ConfigService)
  })

  it('should pass language_code in create payload when language is provided', async () => {
    const mockTranscriptId = 't-2'
    const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
    const completedResponse = {
      status: 200,
      data: { id: mockTranscriptId, status: 'completed', text: 'ok' },
    }
    const postSpy = jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
    jest.spyOn(httpService, 'get').mockReturnValueOnce(of(completedResponse as any))

    await provider.submitAndWaitByUrl({
      audioUrl: mockAudioUrl,
      apiKey: mockApiKey,
      language: 'ru',
    })

    expect(postSpy).toHaveBeenCalledWith(
      'https://api.assemblyai.com/v2/transcript',
      expect.objectContaining({
        audio_url: mockAudioUrl,
        punctuate: true,
        language_code: 'ru',
        format_text: true,
      }),
      expect.anything()
    )
  })

  it('should abort when signal is already aborted', async () => {
    const ac = new AbortController()
    ac.abort()

    await expect(
      provider.submitAndWaitByUrl({
        audioUrl: mockAudioUrl,
        apiKey: mockApiKey,
        signal: ac.signal,
      })
    ).rejects.toMatchObject({ status: 499 })
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.STT_POLL_INTERVAL_MS
    delete process.env.STT_MAX_SYNC_WAIT_MINUTES
    delete process.env.STT_REQUEST_TIMEOUT_SECONDS
  })

  describe('submitAndWaitByUrl', () => {
    it('should successfully complete transcription (queued → processing → completed)', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const queuedResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const processingResponse = {
        status: 200,
        data: { id: mockTranscriptId, status: 'processing' },
      }
      const completedResponse = {
        status: 200,
        data: {
          id: mockTranscriptId,
          status: 'completed',
          text: 'Hello world',
          audio_duration: 5.5,
          language_code: 'en',
          confidence: 0.95,
          words: [
            { start: 0, end: 500, text: 'Hello', confidence: 0.96 },
            { start: 500, end: 1000, text: 'world', confidence: 0.94 },
          ],
        },
      }

      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(of(queuedResponse as any))
        .mockReturnValueOnce(of(processingResponse as any))
        .mockReturnValueOnce(of(completedResponse as any))

      const result = await provider.submitAndWaitByUrl({
        audioUrl: mockAudioUrl,
        apiKey: mockApiKey,
      })

      expect(result).toEqual(
        expect.objectContaining({
          text: 'Hello world',
          requestId: mockTranscriptId,
          durationSec: 5.5,
          language: 'en',
          confidenceAvg: 0.95,
          punctuationRestored: true,
          words: [
            { start: 0, end: 500, text: 'Hello' },
            { start: 500, end: 1000, text: 'world' },
          ],
        })
      )
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.assemblyai.com/v2/transcript',
        expect.objectContaining({
          audio_url: mockAudioUrl,
          punctuate: true,
          format_text: true,
        }),
        expect.objectContaining({ headers: { Authorization: mockApiKey } })
      )
      expect(httpService.get).toHaveBeenCalledTimes(3)
      expect(httpService.get).toHaveBeenCalledWith(
        `https://api.assemblyai.com/v2/transcript/${mockTranscriptId}`,
        expect.objectContaining({ headers: { Authorization: mockApiKey } })
      )
    })

    it('should handle completed status on first poll', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const completedResponse = {
        status: 200,
        data: {
          id: mockTranscriptId,
          status: 'completed',
          text: 'Quick response',
          audio_duration: 1.0,
        },
      }

      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest.spyOn(httpService, 'get').mockReturnValueOnce(of(completedResponse as any))

      const result = await provider.submitAndWaitByUrl({
        audioUrl: mockAudioUrl,
        apiKey: mockApiKey,
      })
      expect(result.text).toBe('Quick response')
      expect(result.requestId).toBe(mockTranscriptId)
      expect(httpService.get).toHaveBeenCalledTimes(1)
    })

    it('should throw ServiceUnavailableException when create request fails', async () => {
      const errorResponse = { status: 400, data: { error: 'Invalid audio URL' } }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(errorResponse as any))
      await expect(
        provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
      ).rejects.toThrow(ServiceUnavailableException)
    })

    it('should throw ServiceUnavailableException when create response has no id', async () => {
      const invalidResponse = { status: 200, data: { status: 'queued' } }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(invalidResponse as any))
      await expect(
        provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
      ).rejects.toThrow(ServiceUnavailableException)
    })

    it('should throw ServiceUnavailableException when status is error', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const errorResponse = {
        status: 200,
        data: { id: mockTranscriptId, status: 'error', error: 'Audio file format not supported' },
      }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest.spyOn(httpService, 'get').mockReturnValueOnce(of(errorResponse as any))
      await expect(
        provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
      ).rejects.toThrow('Audio file format not supported')
    })

    it('should throw ServiceUnavailableException when status is error without error message', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const errorResponse = { status: 200, data: { id: mockTranscriptId, status: 'error' } }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest.spyOn(httpService, 'get').mockReturnValueOnce(of(errorResponse as any))
      await expect(
        provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
      ).rejects.toThrow('Transcription failed')
    })

    it.skip('should throw GatewayTimeoutException after maxSyncWaitMinutes', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const processingResponse = {
        status: 200,
        data: { id: mockTranscriptId, status: 'processing' },
      }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest.spyOn(httpService, 'get').mockReturnValue(of(processingResponse as any))
      await expect(
        provider.submitAndWaitByUrl({ audioUrl: mockAudioUrl, apiKey: mockApiKey })
      ).rejects.toThrow(GatewayTimeoutException)
    })

    it('should continue polling when response body is empty', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const emptyResponse = { status: 200, data: null }
      const completedResponse = {
        status: 200,
        data: { id: mockTranscriptId, status: 'completed', text: 'Recovered' },
      }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(of(emptyResponse as any))
        .mockReturnValueOnce(of(completedResponse as any))
      const result = await provider.submitAndWaitByUrl({
        audioUrl: mockAudioUrl,
        apiKey: mockApiKey,
      })
      expect(result.text).toBe('Recovered')
      expect(httpService.get).toHaveBeenCalledTimes(2)
    }, 10000)

    it('should handle completed response with minimal fields', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const completedResponse = {
        status: 200,
        data: { id: mockTranscriptId, status: 'completed', text: 'Minimal response' },
      }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest.spyOn(httpService, 'get').mockReturnValueOnce(of(completedResponse as any))
      const result = await provider.submitAndWaitByUrl({
        audioUrl: mockAudioUrl,
        apiKey: mockApiKey,
      })
      expect(result).toEqual(
        expect.objectContaining({
          text: 'Minimal response',
          requestId: mockTranscriptId,
          durationSec: undefined,
          language: undefined,
          confidenceAvg: undefined,
          words: undefined,
          punctuationRestored: true,
        })
      )
    }, 10000)

    it('should handle completed response with null text', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const completedResponse = {
        status: 200,
        data: { id: mockTranscriptId, status: 'completed', text: null },
      } as any
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest.spyOn(httpService, 'get').mockReturnValueOnce(of(completedResponse as any))
      const result = await provider.submitAndWaitByUrl({
        audioUrl: mockAudioUrl,
        apiKey: mockApiKey,
      })
      expect(result.text).toBe('')
    }, 10000)

    it('should correctly map words array excluding confidence field', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const completedResponse = {
        status: 200,
        data: {
          id: mockTranscriptId,
          status: 'completed',
          text: 'Test words',
          words: [
            { start: 0, end: 100, text: 'Test', confidence: 0.99 },
            { start: 100, end: 200, text: 'words', confidence: 0.98 },
          ],
        },
      }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest.spyOn(httpService, 'get').mockReturnValueOnce(of(completedResponse as any))
      const result = await provider.submitAndWaitByUrl({
        audioUrl: mockAudioUrl,
        apiKey: mockApiKey,
      })
      expect(result.words).toEqual([
        { start: 0, end: 100, text: 'Test' },
        { start: 100, end: 200, text: 'words' },
      ])
      expect(result.words![0]).not.toHaveProperty('confidence')
    }, 10000)

    it('should handle empty words array', async () => {
      const createResponse = { status: 200, data: { id: mockTranscriptId, status: 'queued' } }
      const completedResponse = {
        status: 200,
        data: { id: mockTranscriptId, status: 'completed', text: '', words: [] },
      }
      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(createResponse as any))
      jest.spyOn(httpService, 'get').mockReturnValueOnce(of(completedResponse as any))
      const result = await provider.submitAndWaitByUrl({
        audioUrl: mockAudioUrl,
        apiKey: mockApiKey,
      })
      expect(result.words).toEqual([])
    }, 10000)
  })
})
