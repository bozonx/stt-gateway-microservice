import { type NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from './test-app.factory.js'
import nock from 'nock'
import FormData from 'form-data'
import { Readable } from 'stream'

describe('Transcription Stream (e2e)', () => {
  let app: NestFastifyApplication

  const originalEnv = process.env

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      TMP_FILES_BASE_URL: 'http://tmp-files-mock:8080/api/v1',
      ASSEMBLYAI_API_KEY: 'mock-api-key',
    }
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
    process.env = originalEnv
  })

  it('POST /transcribe/stream should forward stream and return transcription', async () => {
    const tmpFilesBaseUrl = 'http://tmp-files-mock:8080/api/v1'
    const assemblyAiUrl = 'https://api.assemblyai.com/v2'
    
    // Mock tmp-files upload
    nock('http://tmp-files-mock:8080')
      .post('/api/v1/files')
      .reply(201, {
        downloadUrl: '/api/v1/download/mock-uuid',
      })

    // Mock AssemblyAI flow
    nock('https://api.assemblyai.com')
      .post('/v2/transcript')
      .reply(200, { id: 'mock-id' })
      .get('/v2/transcript/mock-id')
      .reply(200, {
        status: 'completed',
        text: 'Hello from stream',
        id: 'mock-id',
        audio_duration: 10,
        language_code: 'en_us',
        confidence: 0.99,
        words: [{ text: 'Hello', start: 0, end: 500, confidence: 0.99 }],
      })

    const form = new FormData()
    form.append('file', Buffer.from('fake audio content'), {
      filename: 'test.mp3',
      contentType: 'audio/mpeg',
    })
    form.append('provider', 'assemblyai')
    form.append('language', 'en')
    form.append('restorePunctuation', 'true')
    form.append('formatText', 'true')
    form.append('maxWaitMinutes', '5')

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transcribe/stream',
      headers: {
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.text).toBe('Hello from stream')
    expect(body.provider).toBe('assemblyai')
    expect(body.requestId).toBe('mock-id')
  })

  it('POST /transcribe/stream should work when fields are sent AFTER the file', async () => {
    // Mock tmp-files upload
    nock('http://tmp-files-mock:8080')
      .post('/api/v1/files')
      .reply(201, {
        downloadUrl: '/api/v1/download/mock-uuid-2',
      })

    // Mock AssemblyAI flow
    nock('https://api.assemblyai.com')
      .post('/v2/transcript')
      .reply(200, { id: 'mock-id-2' })
      .get('/v2/transcript/mock-id-2')
      .reply(200, {
        status: 'completed',
        text: 'Fields after file works',
        id: 'mock-id-2',
      })
      
    // IMPORTANT: We do NOT mock HEAD request here. 
    // If TranscriptionService tries to do a HEAD request to tmp-files-mock, 
    // nock will throw an error since it's not mocked, failing the test if not skipped.

    const form = new FormData()
    // Append file FIRST
    form.append('file', Buffer.from('fake audio content'), {
      filename: 'test-after.mp3',
      contentType: 'audio/mpeg',
    })
    // Append fields AFTER
    form.append('provider', 'assemblyai')
    form.append('language', 'en')

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transcribe/stream',
      headers: {
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.text).toBe('Fields after file works')
    expect(body.provider).toBe('assemblyai')
  })

  it('POST /transcribe/stream should return 400 if not multipart', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transcribe/stream',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({}),
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.payload)
    expect(body.message).toContain('multipart/form-data')
  })
})
