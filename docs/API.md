# API Documentation

Base URL format: `/{API_BASE_PATH}/v1`

- Default in development: `http://localhost:8080/api/v1`
- Default in Docker Compose: `http://localhost:8080/api/v1`

## Authentication

- No service-level authentication is implemented.
- The provider API key is supplied per request via body field `apiKey`.
- If `apiKey` is omitted, the service falls back to environment variable `ASSEMBLYAI_API_KEY` for the AssemblyAI provider.
- Requests with HTTP `Authorization` header are not used by the service.

## Request headers

- `Content-Type: application/json` is required for POST requests.
- The service may perform a HEAD request to the `audioUrl` to read `Content-Length` for size checks. This is transparent to clients.

## Health

- `GET /health` — Basic health check

Example:

```bash
curl http://localhost:8080/api/v1/health
```

Response:

```json
{ "status": "ok" }
```

## Transcriptions

- `POST /transcribe` — Synchronous transcription by public audio URL

Request body:

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "provider": "assemblyai",
  "timestamps": false,
  "restorePunctuation": true,
  "language": "en",
  "formatText": true,
  "apiKey": "YOUR_ASSEMBLYAI_KEY"
}
```

Field details:

- `audioUrl` (string, required)
  - Must be HTTP(S).
  - WebDAV endpoints are supported when accessible via HTTP(S) paths (e.g., `https://example.com/remote.php/dav/files/...`).
  - URL schemes like `webdav://` or `davs://` are not supported.
  - Private/loopback hosts are rejected (e.g., 127.0.0.1, localhost, 10.0.0.0/8).
- `provider` (string, optional)
  - Defaults to `STT_DEFAULT_PROVIDER` if omitted.
  - If `STT_ALLOWED_PROVIDERS` is non-empty, the provider must be in this comma-separated list.
  - If `STT_ALLOWED_PROVIDERS` is empty or unset, all registered providers are allowed.
- `timestamps` (boolean, optional)
  - If true, provider is requested to include word-level timestamps (when supported).
- `restorePunctuation` (boolean, optional)
  - If true, provider is requested to restore/add punctuation in the transcript.
  - Defaults to `true` when the service/provider supports it (e.g., AssemblyAI).
- `language` (string, optional)
  - Explicit language code for the audio, e.g., `en`, `ru`, `en-US`.
  - Value is trimmed and forwarded to the provider as-is (no server-side validation).
  - See AssemblyAI's supported languages: https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages.
  - When omitted, provider auto-detection may be used if supported by the provider.
- `formatText` (boolean, optional)
  - Whether to format text output (punctuation, capitalization).
  - Defaults to `true`. If omitted, the service still sends `format_text: true` to AssemblyAI.
- `apiKey` (string, optional)
  - If provided, used as the provider API key for this request (BYO key).
  - If omitted, the service will fall back to `ASSEMBLYAI_API_KEY` from environment.

Example (curl):

```bash
curl -X POST \
  http://localhost:8080/api/v1/transcribe \
  -H 'Content-Type: application/json' \
  -d '{
    "audioUrl": "https://example.com/audio.mp3",
    "provider": "assemblyai",
    "timestamps": false,
    "restorePunctuation": true,
    "language": "en",
    "formatText": true,
    "apiKey": "YOUR_ASSEMBLYAI_KEY"
  }'
```

Successful response (200):

```json
{
  "text": "Transcribed text...",
  "provider": "assemblyai",
  "requestId": "abc123",
  "durationSec": 123.45,
  "language": "en",
  "confidenceAvg": 0.92,
  "wordsCount": 204,
  "processingMs": 8421,
  "timestampsEnabled": false,
  "punctuationRestored": true
}
```

### Processing model and limits

- The service does NOT download audio files. It forwards the original URL to the provider (e.g., `audio_url` for AssemblyAI).
- A pre-flight HEAD request may be performed to the `audioUrl`.
  - If the server returns `Content-Length`, it's compared to `STT_MAX_FILE_SIZE_MB`.
  - If size exceeds the limit → `400 File too large`.
  - If `Content-Length` is missing or HEAD is unavailable → size check is skipped (request proceeds).
- Request-level timeouts and polling:
  - Single HTTP request timeout: `STT_REQUEST_TIMEOUT_SECONDS`.
  - Poll interval: `STT_POLL_INTERVAL_MS`.
  - Maximum synchronous wait: `STT_MAX_SYNC_WAIT_MINUTES` (after which the service returns `504 Gateway Timeout`).

### Status codes

- `200 OK` — Transcription finished successfully.
- `400 Bad Request` — Invalid URL, private/loopback host, unsupported provider, or file too large (when `Content-Length` is known).
- `401 Unauthorized` — No provider API key available (neither in body `apiKey` nor in env `ASSEMBLYAI_API_KEY`).
- `503 Service Unavailable` — Provider error.
- `504 Gateway Timeout` — Exceeded maximum synchronous waiting time.


### Error examples

The global error filter returns a consistent response shape:

```json
{
  "statusCode": 400,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/v1/transcribe",
  "method": "POST",
  "message": "...",
  "error": { "statusCode": 400, "message": "...", "error": "Bad Request" }
}
```

- 400 Invalid URL

```json
{
  "statusCode": 400,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/v1/transcribe",
  "method": "POST",
  "message": "audioUrl must be a valid URL",
  "error": { "statusCode": 400, "message": "audioUrl must be a valid URL", "error": "Bad Request" }
}
```

- 400 Private/loopback host

```json
{
  "statusCode": 400,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/v1/transcribe",
  "method": "POST",
  "message": "Private/loopback hosts are not allowed",
  "error": { "statusCode": 400, "message": "Private/loopback hosts are not allowed", "error": "Bad Request" }
}
```

- 401 Missing provider API key

```json
{
  "statusCode": 401,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/v1/transcribe",
  "method": "POST",
  "message": "Missing provider API key",
  "error": { "statusCode": 401, "message": "Missing provider API key", "error": "Unauthorized" }
}
```

- 503 Provider error

```json
{
  "statusCode": 503,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/v1/transcribe",
  "method": "POST",
  "message": "Failed to create transcription",
  "error": { "statusCode": 503, "message": "Failed to create transcription", "error": "Service Unavailable" }
}
```

- 504 Timeout

```json
{
  "statusCode": 504,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/v1/transcribe",
  "method": "POST",
  "message": "TRANSCRIPTION_TIMEOUT",
  "error": { "statusCode": 504, "message": "TRANSCRIPTION_TIMEOUT", "error": "Gateway Timeout" }
}
```
