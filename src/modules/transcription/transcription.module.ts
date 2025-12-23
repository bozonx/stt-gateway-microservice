import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TranscriptionService } from './transcription.service.js';
import { TranscriptionController } from './transcription.controller.js';
import { AssemblyAiProvider } from '../../providers/assemblyai/assemblyai.provider.js';
import type { SttConfig } from '../../config/stt.config.js';
import { SttProviderRegistry } from '../../providers/stt-provider.registry.js';
import { STT_PROVIDER } from '../../common/constants/tokens.js';

/**
 * Transcription module
 * Provides speech-to-text transcription functionality with pluggable provider support
 */
@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const timeoutSec = cfg.get<number>('stt.providerApiTimeoutSeconds', 15);
        return {
          timeout: timeoutSec * 1000,
          maxRedirects: 3,
          validateStatus: () => true,
        };
      },
    }),
  ],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    AssemblyAiProvider,
    SttProviderRegistry,
    {
      provide: STT_PROVIDER,
      inject: [ConfigService, SttProviderRegistry, AssemblyAiProvider],
      useFactory: (
        configService: ConfigService,
        registry: SttProviderRegistry,
        assembly: AssemblyAiProvider,
      ) => {
        const cfg = configService.get<SttConfig>('stt');
        const name = (cfg?.defaultProvider ?? 'assemblyai').toLowerCase();
        return registry.get(name) ?? assembly;
      },
    },
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule { }
