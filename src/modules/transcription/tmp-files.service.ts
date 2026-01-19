import { Injectable, Inject, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { PinoLogger } from 'nestjs-pino'
import { firstValueFrom } from 'rxjs'
import { Readable } from 'node:stream'
import FormData from 'form-data'
import { SttConfig } from '../../config/stt.config.js'

@Injectable()
export class TmpFilesService {
  private readonly cfg: SttConfig

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    @Inject(PinoLogger) private readonly logger: PinoLogger
  ) {
    this.cfg = this.configService.get<SttConfig>('stt')!
    this.logger.setContext(TmpFilesService.name)
  }

  /**
   * Uploads a file stream to the temporary files microservice.
   * @param stream The audio file stream
   * @param filename Original filename
   * @param contentType MIME type of the file
   * @returns downloadUrl from the tmp-files service
   */
  public async uploadStream(
    stream: Readable,
    filename: string,
    contentType: string
  ): Promise<string> {
    this.logger.info(`Forwarding stream to tmp-files service: ${filename} (${contentType})`)

    const form = new FormData()
    form.append('file', stream, { filename, contentType })
    form.append('ttlMins', this.cfg.tmpFilesDefaultTtlMins.toString())

    try {
      const response = await firstValueFrom(
        this.http.post(`${this.cfg.tmpFilesBaseUrl}/files`, form, {
          headers: {
            ...form.getHeaders(),
          },
          // We don't want to buffer the whole file in memory if we can avoid it.
          // Axios + FormData usually handles streams well, but we need to ensure it's not buffered.
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        })
      )

      if (response.status !== 201) {
        this.logger.error(`Failed to upload to tmp-files service. Status: ${response.status}`)
        throw new InternalServerErrorException('Failed to upload file to temporary storage')
      }

      const { downloadUrl } = response.data
      if (!downloadUrl) {
        this.logger.error('No downloadUrl returned from tmp-files service')
        throw new InternalServerErrorException('Invalid response from temporary storage')
      }

      // If downloadUrl is relative, prepend the base URL
      const finalUrl = downloadUrl.startsWith('http')
        ? downloadUrl
        : new URL(downloadUrl, this.cfg.tmpFilesBaseUrl).toString()

      this.logger.info(`Stream successfully forwarded. Temporary URL: ${finalUrl}`)
      return finalUrl
    } catch (error: any) {
      this.logger.error(`Error uploading to tmp-files: ${error.message}`)
      
      if (error.response?.status === 413) {
        throw new BadRequestException('File too large for temporary storage')
      }
      
      throw new InternalServerErrorException(
        `Failed to forward stream to temporary storage: ${error.message}`
      )
    }
  }
}
