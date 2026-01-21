import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici'
import { jest } from '@jest/globals'
import { Readable } from 'node:stream'

// Dynamic imports
import type { TmpFilesService as TmpFilesServiceType } from '../../src/modules/transcription/tmp-files.service.js'
const { TmpFilesService } = await import('../../src/modules/transcription/tmp-files.service.js')

import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { BadRequestException, InternalServerErrorException, HttpException } from '@nestjs/common'
import { createMockLogger } from '@test/helpers/mocks'

describe('TmpFilesService', () => {
  let service: TmpFilesServiceType
  let configService: ConfigService
  let mockAgent: MockAgent

  const mockConfig: Record<string, any> = {
    stt: {
      tmpFilesBaseUrl: 'http://tmp-files-mock',
      tmpFilesDefaultTtlMins: 30,
    },
  }

  beforeEach(async () => {
    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    setGlobalDispatcher(mockAgent)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmpFilesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => mockConfig[key]),
          },
        },
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
      ],
    }).compile()

    service = module.get<TmpFilesServiceType>(TmpFilesService)
    configService = module.get<ConfigService>(ConfigService)
  })

  afterEach(() => {
    // Cleanup if needed, though beforeEach resets the agent
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should successfully upload a stream and return the download URL', async () => {
    const mockPool = mockAgent.get(mockConfig.stt.tmpFilesBaseUrl)
    mockPool
      .intercept({
        path: '/files',
        method: 'POST',
      })
      .reply(201, {
        downloadUrl: '/api/v1/download/uuid-123',
      })

    const mockStream = Readable.from(['test audio data'])
    const result = await service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg')

    expect(result).toBe('http://tmp-files-mock/api/v1/download/uuid-123')
  })

  it('should return the full download URL if the service returns a full URL', async () => {
    const fullUrl = 'https://external-storage.com/file/uuid-456'

    const mockPool = mockAgent.get(mockConfig.stt.tmpFilesBaseUrl)
    mockPool
      .intercept({
        path: '/files',
        method: 'POST',
      })
      .reply(201, {
        downloadUrl: fullUrl,
      })

    const mockStream = Readable.from(['test'])
    const result = await service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg')

    expect(result).toBe(fullUrl)
  })

  it('should throw BadRequestException when tmp-files returns 413', async () => {
    const mockPool = mockAgent.get(mockConfig.stt.tmpFilesBaseUrl)
    mockPool
      .intercept({
        path: '/files',
        method: 'POST',
      })
      .reply(413, {
        message: 'Payload Too Large',
      })

    const mockStream = Readable.from(['large file'])
    await expect(service.uploadStream(mockStream, 'large.mp3', 'audio/mpeg')).rejects.toThrow(
      BadRequestException
    )
  })

  it('should throw InternalServerErrorException for other errors', async () => {
    const mockPool = mockAgent.get(mockConfig.stt.tmpFilesBaseUrl)
    mockPool
      .intercept({
        path: '/files',
        method: 'POST',
      })
      .reply(500, {
        message: 'Internal Error',
      })

    const mockStream = Readable.from(['test'])
    await expect(service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
      InternalServerErrorException
    )
  })

  it('should throw InternalServerErrorException if downloadUrl is missing in response', async () => {
    const mockPool = mockAgent.get(mockConfig.stt.tmpFilesBaseUrl)
    mockPool
      .intercept({
        path: '/files',
        method: 'POST',
      })
      .reply(201, {})

    const mockStream = Readable.from(['test'])
    await expect(service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
      InternalServerErrorException
    )
  })

  it('should throw HttpException with 499 when request is aborted', async () => {
    const abortController = new AbortController()
    abortController.abort()

    const mockStream = Readable.from(['test'])
    await expect(
      service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg', abortController.signal)
    ).rejects.toMatchObject({
      status: 499,
    })

    await expect(
      service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg', abortController.signal)
    ).rejects.toThrow(HttpException)
  })
})
