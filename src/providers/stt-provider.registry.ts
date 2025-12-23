import { Injectable } from '@nestjs/common'
import type { SttProvider } from '../common/interfaces/stt-provider.interface.js'
import { AssemblyAiProvider } from './assemblyai/assemblyai.provider.js'

@Injectable()
export class SttProviderRegistry {
  constructor(private readonly assemblyAiProvider: AssemblyAiProvider) {}

  public get(providerName: string): SttProvider | undefined {
    switch (providerName.toLowerCase()) {
      case 'assemblyai':
        return this.assemblyAiProvider
      default:
        return undefined
    }
  }
}
