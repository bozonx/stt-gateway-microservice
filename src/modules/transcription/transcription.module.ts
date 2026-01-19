import { Module, OnModuleInit } from '@nestjs/common'

import { ConfigModule, ConfigService } from '@nestjs/config'
import { TranscriptionService } from './transcription.service.js'
import { TranscriptionController } from './transcription.controller.js'
import { AssemblyAiProvider } from '../../providers/assemblyai/assemblyai.provider.js'
import type { SttConfig } from '../../config/stt.config.js'
import { SttProviderRegistry } from '../../providers/stt-provider.registry.js'
import { STT_PROVIDER } from '../../common/constants/tokens.js'
import { TmpFilesService } from './tmp-files.service.js'
import fastifyMultipart from '@fastify/multipart'
import { ModuleRef, HttpAdapterHost } from '@nestjs/core'

/**
 * Transcription module
 * Provides speech-to-text transcription functionality with pluggable provider support
 */
@Module({
  imports: [ConfigModule],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    TmpFilesService,
    AssemblyAiProvider,
    SttProviderRegistry,
    {
      provide: STT_PROVIDER,
      inject: [ConfigService, SttProviderRegistry, AssemblyAiProvider],
      useFactory: (
        configService: ConfigService,
        registry: SttProviderRegistry,
        assembly: AssemblyAiProvider
      ) => {
        const cfg = configService.get<SttConfig>('stt')
        const name = (cfg?.defaultProvider ?? 'assemblyai').toLowerCase()
        return registry.get(name) ?? assembly
      },
    },
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit() {
    const httpAdapterHost = this.moduleRef.get(HttpAdapterHost, { strict: false })
    const fastify = httpAdapterHost.httpAdapter.getInstance()

    await fastify.register(fastifyMultipart, {
      limits: {
        fieldNameSize: 100,
        fieldSize: 1000,
        fields: 10,
        fileSize: 100 * 1024 * 1024,
        files: 1,
      },
    })
  }
}
