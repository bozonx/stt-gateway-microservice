import type { SttConfig } from '../../config/stt.config.js'
import type { Logger } from '../../common/interfaces/logger.interface.js'
import {
  BadRequestError,
  InternalServerError,
  ClientClosedRequestError,
} from '../../common/errors/http-error.js'
import { isAbortError } from '../../utils/error.utils.js'

export class TmpFilesService {
  constructor(
    private readonly cfg: SttConfig,
    private readonly logger: Logger
  ) {}

  /**
   * Uploads a file stream to the temporary files microservice using streaming multipart.
   * Pipes chunks directly without buffering the entire file in memory.
   * @param fileStream ReadableStream of the file data
   * @param filename Original filename
   * @param contentType MIME type of the file
   * @param signal Optional AbortSignal for cancellation
   * @returns downloadUrl from the tmp-files service
   */
  public async uploadStream(
    fileStream: ReadableStream<Uint8Array>,
    filename: string,
    contentType: string,
    contentLengthBytes?: number,
    signal?: AbortSignal
  ): Promise<string> {
    this.logger.info(`Streaming file to tmp-files service: ${filename} (${contentType})`)

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'X-File-Name': filename,
      'X-Ttl-Mins': this.cfg.tmpFilesDefaultTtlMins.toString(),
    }
    if (typeof contentLengthBytes === 'number' && Number.isFinite(contentLengthBytes)) {
      headers['Content-Length'] = String(Math.max(0, Math.trunc(contentLengthBytes)))
    }
    if (this.cfg.tmpFilesBearerToken) {
      headers['Authorization'] = `Bearer ${this.cfg.tmpFilesBearerToken}`
    }

    try {
      const res = await fetch(`${this.cfg.tmpFilesBaseUrl}/files`, {
        method: 'POST',
        // @ts-expect-error duplex is required for streaming body in Node.js but not in Workers
        duplex: 'half',
        body: fileStream,
        headers,
        signal,
      })

      return this.handleUploadResponse(res)
    } catch (error: unknown) {
      return this.handleUploadError(error, signal)
    }
  }

  /**
   * @deprecated Use uploadStream() for streaming uploads without full buffering
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

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'X-File-Name': filename,
      'X-Ttl-Mins': this.cfg.tmpFilesDefaultTtlMins.toString(),
    }
    if (Number.isFinite(file.size)) {
      headers['Content-Length'] = String(Math.max(0, Math.trunc(file.size)))
    }
    if (this.cfg.tmpFilesBearerToken) {
      headers['Authorization'] = `Bearer ${this.cfg.tmpFilesBearerToken}`
    }

    try {
      const res = await fetch(`${this.cfg.tmpFilesBaseUrl}/files`, {
        method: 'POST',
        body: file,
        headers,
        signal,
      })

      return this.handleUploadResponse(res)
    } catch (error: unknown) {
      return this.handleUploadError(error, signal)
    }
  }

  private async handleUploadResponse(res: Response): Promise<string> {
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
  }

  private handleUploadError(error: unknown, signal?: AbortSignal): never {
    if (error instanceof BadRequestError) {
      throw error
    }

    if (isAbortError(error) || signal?.aborted) {
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
