
import { MockAgent, setGlobalDispatcher } from 'undici'
import { jest } from '@jest/globals'
import type { TranscriptionService as TranscriptionServiceType } from '../../src/modules/transcription/transcription.service.js'

// Dynamic imports
const { TranscriptionService } = await import('../../src/modules/transcription/transcription.service.js')

import { Test } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { AssemblyAiProvider } from '@/providers/assemblyai/assemblyai.provider'
import { STT_PROVIDER } from '@common/constants/tokens'
import { PinoLogger } from 'nestjs-pino'
import appConfig from '@config/app.config'
import sttConfig from '@config/stt.config'
import { createMockLogger } from '@test/helpers/mocks'

describe('TranscriptionService', () => {
  let mockAgent: MockAgent

  beforeEach(() => {
    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    setGlobalDispatcher(mockAgent)
  })

  it('rejects private host url', async () => {
    const mockProvider = { submitAndWaitByUrl: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig, sttConfig],
        }),
      ],
      providers: [
        TranscriptionService,
        AssemblyAiProvider,
        {
          provide: STT_PROVIDER,
          useValue: mockProvider,
        },
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
      ],
    }).compile()

    const svc = moduleRef.get(TranscriptionService)
    await expect(svc.transcribeByUrl({ audioUrl: 'http://localhost:8000/a.mp3' })).rejects.toThrow()
  })

  it('returns response shape on success', async () => {
    process.env.ASSEMBLYAI_API_KEY = 'x'
    
    // Intercept HEAD request for size check
    const mockPool = mockAgent.get('https://example.com')
    mockPool.intercept({
      path: '/a.mp3',
      method: 'HEAD',
    }).reply(200, '', {
        headers: { 'content-length': '100' }
    })

    const mockProvider = {
      submitAndWaitByUrl: jest.fn().mockResolvedValue({
        text: 'hello',
        requestId: 'id1',
        durationSec: 1,
        language: 'en',
        confidenceAvg: 0.9,
        words: [{ start: 0, end: 100, text: 'hello' }],
      }),
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig, sttConfig],
        }),
      ],
      providers: [
        TranscriptionService,
        AssemblyAiProvider,
        {
          provide: STT_PROVIDER,
          useValue: mockProvider,
        },
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
      ],
    }).compile()

    const svc = moduleRef.get(TranscriptionService)
    const res = await svc.transcribeByUrl({ audioUrl: 'https://example.com/a.mp3' })
    expect(res.text).toBe('hello')
    expect(res.provider).toBe('assemblyai')
    expect(res.requestId).toBe('id1')
    expect(res.wordsCount).toBe(1)
    expect(res.punctuationRestored).toBe(true)
  })

  it('trims language before forwarding to provider', async () => {
    process.env.ASSEMBLYAI_API_KEY = 'x'
    
    // Intercept HEAD request for size check
    const mockPool = mockAgent.get('https://example.com')
    mockPool.intercept({
      path: '/a.mp3',
      method: 'HEAD',
    }).reply(200, '', {
        headers: { }
    })

    const mockProvider = {
      submitAndWaitByUrl: jest.fn().mockResolvedValue({
        text: 'ok',
        requestId: 'id2',
        punctuationRestored: true,
      }),
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig, sttConfig],
        }),
      ],
      providers: [
        TranscriptionService,
        AssemblyAiProvider,
        {
          provide: STT_PROVIDER,
          useValue: mockProvider,
        },
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
      ],
    }).compile()

    const svc = moduleRef.get(TranscriptionService)
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
    process.env.ASSEMBLYAI_API_KEY = 'x'
    
    // Intercept HEAD request for size check
    const mockPool = mockAgent.get('https://example.com')
    mockPool.intercept({
      path: '/a.mp3',
      method: 'HEAD',
    }).reply(200, '', {
        headers: { }
    })

    const mockProvider = {
      submitAndWaitByUrl: jest.fn().mockResolvedValue({
        text: 'ok',
        requestId: 'id3',
        punctuationRestored: true,
      }),
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig, sttConfig],
        }),
      ],
      providers: [
        TranscriptionService,
        AssemblyAiProvider,
        {
          provide: STT_PROVIDER,
          useValue: mockProvider,
        },
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
      ],
    }).compile()

    const svc = moduleRef.get(TranscriptionService)
    const ac = new AbortController()

    await svc.transcribeByUrl({
      audioUrl: 'https://example.com/a.mp3',
      signal: ac.signal,
    })

    expect(mockProvider.submitAndWaitByUrl).toHaveBeenCalledWith(
      expect.objectContaining({ signal: ac.signal })
    )
  })
})
