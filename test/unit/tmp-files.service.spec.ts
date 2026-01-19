import { Test, TestingModule } from '@nestjs/testing'
import { TmpFilesService } from '@modules/transcription/tmp-files.service'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { of, throwError } from 'rxjs'
import { Readable } from 'node:stream'
import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { createMockLogger } from '../helpers/mocks'

describe('TmpFilesService', () => {
  let service: TmpFilesService
  let httpService: HttpService
  let configService: ConfigService

  const mockConfig: Record<string, any> = {
    stt: {
      tmpFilesBaseUrl: 'http://tmp-files-mock',
      tmpFilesDefaultTtlMins: 30,
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmpFilesService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
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

    service = module.get<TmpFilesService>(TmpFilesService)
    httpService = module.get<HttpService>(HttpService)
    configService = module.get<ConfigService>(ConfigService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should successfully upload a stream and return the download URL', async () => {
    const mockResponse = {
      status: 201,
      data: {
        downloadUrl: '/api/v1/download/uuid-123',
      },
    }
    ;(httpService.post as jest.Mock).mockReturnValue(of(mockResponse))

    const mockStream = Readable.from(['test audio data'])
    const result = await service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg')

    expect(httpService.post).toHaveBeenCalledWith(
      `${mockConfig.stt.tmpFilesBaseUrl}/files`,
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'content-type': expect.stringContaining('multipart/form-data'),
        }),
      })
    )
    expect(result).toBe('http://tmp-files-mock/api/v1/download/uuid-123')
  })

  it('should return the full download URL if the service returns a full URL', async () => {
    const fullUrl = 'https://external-storage.com/file/uuid-456'
    const mockResponse = {
      status: 201,
      data: {
        downloadUrl: fullUrl,
      },
    }
    ;(httpService.post as jest.Mock).mockReturnValue(of(mockResponse))

    const mockStream = Readable.from(['test'])
    const result = await service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg')

    expect(result).toBe(fullUrl)
  })

  it('should throw BadRequestException when tmp-files returns 413', async () => {
    const errorResponse = {
      response: {
        status: 413,
      },
      message: 'Payload Too Large',
    }
    ;(httpService.post as jest.Mock).mockReturnValue(throwError(() => errorResponse))

    const mockStream = Readable.from(['large file'])
    await expect(service.uploadStream(mockStream, 'large.mp3', 'audio/mpeg')).rejects.toThrow(
      BadRequestException
    )
  })

  it('should throw InternalServerErrorException for other errors', async () => {
    ;(httpService.post as jest.Mock).mockReturnValue(throwError(() => new Error('Connection error')))

    const mockStream = Readable.from(['test'])
    await expect(service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
      InternalServerErrorException
    )
  })

  it('should throw InternalServerErrorException if downloadUrl is missing in response', async () => {
    const mockResponse = {
      status: 201,
      data: {},
    }
    ;(httpService.post as jest.Mock).mockReturnValue(of(mockResponse))

    const mockStream = Readable.from(['test'])
    await expect(service.uploadStream(mockStream, 'test.mp3', 'audio/mpeg')).rejects.toThrow(
      InternalServerErrorException
    )
  })
})
