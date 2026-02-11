/**
 * Utility for building a multipart/form-data body as a ReadableStream.
 * Uses only Web Streams API — works on both Node.js and Cloudflare Workers.
 */

export interface MultipartTextField {
  name: string
  value: string
}

export interface MultipartFileField {
  name: string
  filename: string
  contentType: string
  stream: ReadableStream<Uint8Array>
}

export interface MultipartStreamResult {
  body: ReadableStream<Uint8Array>
  contentType: string
  boundary: string
}

/**
 * Generates a random multipart boundary string
 */
function generateBoundary(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = '----FormBoundary'
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

const encoder = new TextEncoder()

/**
 * Creates a multipart/form-data ReadableStream that pipes the file stream
 * without buffering the entire file in memory.
 *
 * Layout:
 *   --boundary\r\n Content-Disposition: form-data; name="field"\r\n\r\n value\r\n   (for each text field)
 *   --boundary\r\n Content-Disposition: form-data; name="file"; filename="..."\r\n Content-Type: ...\r\n\r\n
 *   <file stream bytes>
 *   \r\n--boundary--\r\n
 */
export function createMultipartStream(params: {
  textFields: MultipartTextField[]
  fileField: MultipartFileField
}): MultipartStreamResult {
  const boundary = generateBoundary()
  const { textFields, fileField } = params

  // Build the preamble: all text fields + file part headers
  let preamble = ''
  for (const field of textFields) {
    preamble += `--${boundary}\r\n`
    preamble += `Content-Disposition: form-data; name="${field.name}"\r\n\r\n`
    preamble += `${field.value}\r\n`
  }
  preamble += `--${boundary}\r\n`
  preamble += `Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\n`
  preamble += `Content-Type: ${fileField.contentType}\r\n\r\n`

  const epilogue = `\r\n--${boundary}--\r\n`

  const preambleBytes = encoder.encode(preamble)
  const epilogueBytes = encoder.encode(epilogue)

  let phase: 'preamble' | 'file' | 'epilogue' | 'done' = 'preamble'
  let fileReader: ReadableStreamDefaultReader<Uint8Array> | null = null

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (phase === 'preamble') {
        controller.enqueue(preambleBytes)
        phase = 'file'
        fileReader = fileField.stream.getReader()
        return
      }

      if (phase === 'file' && fileReader) {
        const { done, value } = await fileReader.read()
        if (done) {
          fileReader.releaseLock()
          phase = 'epilogue'
          controller.enqueue(epilogueBytes)
          phase = 'done'
          controller.close()
          return
        }
        controller.enqueue(value)
        return
      }

      // Should not reach here, but close just in case
      controller.close()
    },
    cancel() {
      if (fileReader) {
        fileReader.cancel().catch(() => {})
      }
    },
  })

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
    boundary,
  }
}
