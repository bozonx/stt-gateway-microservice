import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  ServiceUnavailableException,
  GatewayTimeoutException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { lastValueFrom, timeout } from 'rxjs';
import type {
  SttProvider,
  TranscriptionRequestByUrl,
  TranscriptionResult,
} from '../../common/interfaces/stt-provider.interface.js';
import type { SttConfig } from '../../config/stt.config.js';
import { ASSEMBLYAI_API } from '../../common/constants/app.constants.js';

interface AssemblyCreateResponse {
  id: string;
  status: string;
}

interface AssemblyTranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
  words?: Array<{ start: number; end: number; text: string; confidence?: number }>;
  audio_duration?: number;
  language_code?: string;
  confidence?: number; // some payloads expose average confidence
}

@Injectable()
export class AssemblyAiProvider implements SttProvider {
  private readonly cfg: SttConfig;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.cfg = this.configService.get<SttConfig>('stt')!;
    logger.setContext(AssemblyAiProvider.name);
  }

  public async submitAndWaitByUrl(params: TranscriptionRequestByUrl): Promise<TranscriptionResult> {
    const hostForLog = (() => {
      try {
        return new URL(params.audioUrl).hostname;
      } catch {
        return undefined;
      }
    })();
    this.logger.debug(
      hostForLog
        ? `Submitting transcription request to AssemblyAI for host: ${hostForLog}`
        : 'Submitting transcription request to AssemblyAI',
    );

    const headers = { Authorization: params.apiKey as string };
    const apiUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}`;
    const payload: Record<string, any> = {
      audio_url: params.audioUrl,
    };
    payload.punctuate = params.restorePunctuation === false ? false : true;
    // Explicit language when provided
    if (params.language) {
      const trimmed = params.language.trim();
      if (trimmed.length > 0) {
        payload.language_code = trimmed;
      }
    }
    // Format text output (default: true)
    payload.format_text = params.formatText === false ? false : true;
    this.logger.debug(
      `AssemblyAI create request: url=${apiUrl}, hasAuthHeader=${Boolean(
        headers.Authorization,
      )}, punctuate=${Boolean(payload.punctuate)}, language_code=${payload.language_code ?? 'auto'
      }, format_text=${Boolean(payload.format_text)}`,
    );
    const create$ = this.http.post<AssemblyCreateResponse>(apiUrl, payload, {
      headers,
      validateStatus: () => true,
    });

    const createRes = await lastValueFrom(create$.pipe(timeout(this.cfg.requestTimeoutSeconds * 1000)));
    this.logger.debug(
      `AssemblyAI create response: status=${createRes.status}, hasId=${Boolean(
        createRes.data?.id,
      )}`,
    );
    if (createRes.status >= 400 || !createRes.data?.id) {
      const errorDetail = createRes.data ? JSON.stringify(createRes.data) : 'no response body';
      this.logger.error(
        `Failed to create transcription. Status: ${createRes.status}, Response: ${errorDetail}`,
      );
      throw new ServiceUnavailableException('Failed to create transcription');
    }

    const id = createRes.data.id;
    this.logger.info(`Transcription request created with ID: ${id}`);

    const startedAt = Date.now();
    const deadline = startedAt + this.cfg.maxSyncWaitMinutes * 60 * 1000;

    // Poll loop
    let pollCount = 0;
    for (; ;) {
      if (Date.now() > deadline) {
        this.logger.error(
          `Transcription timeout after ${this.cfg.maxSyncWaitMinutes} minutes for ID: ${id}`,
        );
        throw new GatewayTimeoutException('TRANSCRIPTION_TIMEOUT');
      }

      await new Promise(r => setTimeout(r, this.cfg.pollIntervalMs));
      pollCount++;

      this.logger.debug(`Polling transcription status (attempt ${pollCount}) for ID: ${id}`);

      const getUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}/${id}`;
      const get$ = this.http.get<AssemblyTranscriptResponse>(getUrl, {
        headers,
        validateStatus: () => true,
      });
      const getRes = await lastValueFrom(get$.pipe(timeout(this.cfg.requestTimeoutSeconds * 1000)));
      const body = getRes.data;
      this.logger.debug(
        `AssemblyAI poll response: status=${getRes.status}, bodyStatus=${body?.status ?? 'n/a'}`,
      );

      if (!body) {
        this.logger.debug(`No response body for ID: ${id}, continuing...`);
        continue;
      }

      this.logger.debug(`Transcription status: ${body.status} for ID: ${id}`);

      if (body.status === 'completed') {
        this.logger.info(
          `Transcription completed for ID: ${id}. Text length: ${body.text?.length || 0} chars`,
        );
        return {
          text: body.text ?? '',
          requestId: id,
          durationSec: body.audio_duration,
          language: body.language_code,
          confidenceAvg: body.confidence,
          words:
            body.words?.map((w: { start: number; end: number; text: string }) => ({
              start: w.start,
              end: w.end,
              text: w.text,
            })) ?? undefined,
          punctuationRestored: params.restorePunctuation ?? true,
          raw: body,
        };
      }

      if (body.status === 'error') {
        this.logger.error(`Transcription failed for ID: ${id}. Error: ${body.error ?? 'Unknown error'}`);
        throw new ServiceUnavailableException(body.error ?? 'Transcription failed');
      }
    }
  }
}
