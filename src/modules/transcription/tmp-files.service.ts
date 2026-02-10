import type { SttConfig } from '../../config/stt.config.js'
import type { Logger } from '../../common/interfaces/logger.interface.js'
import {
  BadRequestError,
  InternalServerError,
  ClientClosedRequestError,
} from '../../common/errors/http-error.js'

export class TmpFilesService {
  constructor(
    private readonly cfg: SttConfig,
    private readonly logger: Logger
  ) {}

  private isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const err = error as { name?: unknown; code?: unknown; message?: unknown }
    const name = typeof err.name === 'string' ? err.name : undefined
    const code = typeof err.code === 'string' ? err.code : undefined
    const message = typeof err.message === 'string' ? err.message : undefined

    return (
      name === 'AbortError' ||
      code === 'UND_ERR_ABORTED' ||
      message === 'This operation was aborted'
    )
  }

  /**
   * Uploads a file (as Blob/File) to the temporary files microservice using Web-standard FormData.
   * @param file The audio file as a Blob
   * @param filename Original filename
   * @param contentType MIME type of the file
   * @param signal Optional AbortSignal for cancellation
   * @returns downloadUrl from the tmp-files service
   */
  public async uploadFile(
    file: Blob,
    filename: string,
    contentType: string,
    signal?: AbortSignal
  ): Promise<string> {
    this.logger.info(`Forwarding file to tmp-files service: ${filename} (${contentType})`)

    const form = new FormData()
    form.append('file', new File([file], filename, { type: contentType }))
    form.append('ttlMins', this.cfg.tmpFilesDefaultTtlMins.toString())

    try {
      const res = await fetch(`${this.cfg.tmpFilesBaseUrl}/files`, {
        method: 'POST',
        body: form,
        signal,
      })

      if (res.status === 413) {
        throw new BadRequestError('File too large for temporary storage')
      }

      const responseBody = (await res.json()) as Record<string, unknown>

      if (res.status !== 201) {
        this.logger.error(
          `Failed to upload to tmp-files service. Status: ${res.status}, Body: ${JSON.stringify(
            responseBody
          )}`
        )
        throw new InternalServerError('Failed to upload file to temporary storage')
      }

      const downloadUrl = responseBody.downloadUrl as string | undefined
      if (!downloadUrl) {
        this.logger.error('No downloadUrl returned from tmp-files service')
        throw new InternalServerError('Invalid response from temporary storage')
      }

      // If downloadUrl is relative, prepend the base URL
      const finalUrl = downloadUrl.startsWith('http')
        ? downloadUrl
        : new URL(downloadUrl, this.cfg.tmpFilesBaseUrl).toString()

      this.logger.info(`File successfully forwarded. Temporary URL: ${finalUrl}`)
      return finalUrl
    } catch (error: unknown) {
      if (error instanceof BadRequestError) {
        throw error
      }

      if (this.isAbortError(error) || signal?.aborted) {
        throw new ClientClosedRequestError('Upload aborted by client')
      }

      if (error instanceof InternalServerError) {
        throw error
      }

      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Error uploading to tmp-files: ${msg}`)

      throw new InternalServerError(`Failed to forward file to temporary storage: ${msg}`)
    }
  }
}
