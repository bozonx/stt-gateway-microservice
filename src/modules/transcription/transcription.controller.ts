import { Body, Controller, Post, HttpCode, HttpStatus, UseGuards, Inject } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiGatewayTimeoutResponse,
  ApiServiceUnavailableResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PinoLogger } from 'nestjs-pino';
import { TranscribeFileDto } from '@common/dto/transcribe-file.dto';
import { TranscriptionResponseDto } from '@common/dto/transcription-response.dto';
import { AuthGuard } from '@common/guards/auth.guard';
import { TranscriptionService } from './transcription.service';

@ApiTags('Transcriptions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('transcriptions')
export class TranscriptionController {
  constructor(
    private readonly service: TranscriptionService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    logger.setContext(TranscriptionController.name);
  }

  @Post('file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transcribe audio file from URL',
    description:
      'Transcribes an audio file from a publicly accessible URL using a speech-to-text provider. ' +
      'The audio file must be accessible via HTTP/HTTPS and not exceed the maximum file size limit.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription completed successfully',
    type: TranscriptionResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid request parameters (invalid URL, unsupported provider, file too large, private/loopback host)',
    schema: {
      example: {
        statusCode: 400,
        message: 'audioUrl must be a valid URL',
        error: 'Bad Request',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authorization token, or missing provider API key',
    schema: {
      examples: {
        missingAuthHeader: {
          summary: 'Missing Authorization header',
          value: {
            statusCode: 401,
            message: 'Missing Authorization header',
            error: 'Unauthorized',
          },
        },
        invalidAuthToken: {
          summary: 'Invalid authorization token',
          value: {
            statusCode: 401,
            message: 'Invalid authorization token',
            error: 'Unauthorized',
          },
        },
        missingProviderKey: {
          summary: 'Missing provider API key',
          value: {
            statusCode: 401,
            message: 'Missing provider API key',
            error: 'Unauthorized',
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Transcription service is unavailable or provider error',
    schema: {
      example: {
        statusCode: 503,
        message: 'Failed to create transcription',
        error: 'Service Unavailable',
      },
    },
  })
  @ApiGatewayTimeoutResponse({
    description: 'Transcription took too long to complete',
    schema: {
      example: {
        statusCode: 504,
        message: 'TRANSCRIPTION_TIMEOUT',
        error: 'Gateway Timeout',
      },
    },
  })
  public async transcribe(@Body() dto: TranscribeFileDto): Promise<TranscriptionResponseDto> {
    this.logger.info(`Transcription request received for URL: ${dto.audioUrl}`);
    const result = await this.service.transcribeByUrl(dto);
    this.logger.info(
      `Transcription request completed. Provider: ${result.provider}, Processing time: ${result.processingMs}ms`,
    );
    return result;
  }
}
