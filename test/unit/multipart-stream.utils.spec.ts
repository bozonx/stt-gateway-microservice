import { createMultipartStream } from '../../src/utils/multipart-stream.utils.js'

describe('createMultipartStream', () => {
  async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader()
    const parts: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }
    return new TextDecoder().decode(Buffer.concat(parts))
  }

  it('should produce valid multipart body with text fields and file stream', async () => {
    const fileData = new TextEncoder().encode('hello-audio-data')
    const fileStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(fileData)
        controller.close()
      },
    })

    const result = createMultipartStream({
      textFields: [{ name: 'ttlMins', value: '30' }],
      fileField: {
        name: 'file',
        filename: 'test.mp3',
        contentType: 'audio/mpeg',
        stream: fileStream,
      },
    })

    expect(result.contentType).toContain('multipart/form-data; boundary=')
    expect(result.boundary).toBeTruthy()

    const body = await consumeStream(result.body)

    expect(body).toContain(`--${result.boundary}`)
    expect(body).toContain('Content-Disposition: form-data; name="ttlMins"')
    expect(body).toContain('30')
    expect(body).toContain('Content-Disposition: form-data; name="file"; filename="test.mp3"')
    expect(body).toContain('Content-Type: audio/mpeg')
    expect(body).toContain('hello-audio-data')
    expect(body).toContain(`--${result.boundary}--`)
  })

  it('should handle multiple text fields', async () => {
    const fileStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      },
    })

    const result = createMultipartStream({
      textFields: [
        { name: 'field1', value: 'value1' },
        { name: 'field2', value: 'value2' },
      ],
      fileField: {
        name: 'file',
        filename: 'data.bin',
        contentType: 'application/octet-stream',
        stream: fileStream,
      },
    })

    const body = await consumeStream(result.body)

    expect(body).toContain('name="field1"')
    expect(body).toContain('value1')
    expect(body).toContain('name="field2"')
    expect(body).toContain('value2')
  })

  it('should handle empty text fields array', async () => {
    const fileStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data'))
        controller.close()
      },
    })

    const result = createMultipartStream({
      textFields: [],
      fileField: {
        name: 'file',
        filename: 'test.wav',
        contentType: 'audio/wav',
        stream: fileStream,
      },
    })

    const body = await consumeStream(result.body)

    expect(body).toContain('name="file"')
    expect(body).toContain('data')
    expect(body).toContain(`--${result.boundary}--`)
  })

  it('should stream multiple chunks without buffering', async () => {
    const chunks = [
      new Uint8Array([65, 66, 67]),
      new Uint8Array([68, 69, 70]),
      new Uint8Array([71, 72, 73]),
    ]

    const fileStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    })

    const result = createMultipartStream({
      textFields: [],
      fileField: {
        name: 'file',
        filename: 'chunked.bin',
        contentType: 'application/octet-stream',
        stream: fileStream,
      },
    })

    const body = await consumeStream(result.body)
    // ABCDEFGHI should be present in the body
    expect(body).toContain('ABCDEFGHI')
  })

  it('should cancel file stream when body stream is cancelled', async () => {
    let cancelled = false
    const fileStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]))
        // Don't close — simulate a long stream
      },
      cancel() {
        cancelled = true
      },
    })

    const result = createMultipartStream({
      textFields: [],
      fileField: {
        name: 'file',
        filename: 'test.bin',
        contentType: 'application/octet-stream',
        stream: fileStream,
      },
    })

    const reader = result.body.getReader()
    // Read preamble
    await reader.read()
    // Read first file chunk
    await reader.read()
    // Cancel
    await reader.cancel()

    expect(cancelled).toBe(true)
  })
})
