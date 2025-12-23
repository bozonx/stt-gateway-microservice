# API Documentation

This document provides a complete reference for all API endpoints, request/response formats, and status codes.

## Base URL

All endpoints are prefixed with:

```
/{BASE_PATH}/api/v1
```

Where `{BASE_PATH}` is an optional URL prefix configured via the `BASE_PATH` environment variable. If `BASE_PATH` is empty, the base URL is simply `/api/v1`.

**Examples:**
- With `BASE_PATH=voice-gateway`: `http://localhost:8080/voice-gateway/api/v1`
- Without `BASE_PATH` (empty): `http://localhost:8080/api/v1`

---

## Endpoints

### 1. Health Check

**Endpoint:** `GET /{BASE_PATH}/api/v1/health`

**Description:** Simple health check endpoint to verify the service is running.

**Request:**
- Method: `GET`
- Headers: None required
- Body: None

**Response:**

**Success (200 OK):**
```json
{
  "status": "ok"
}
```

**Example:**
```bash
curl http://localhost:8080/api/v1/health
```

---

### 2. Transcribe Audio

**Endpoint:** `POST /{BASE_PATH}/api/v1/transcribe`

**Description:** Synchronously transcribes audio from a public URL. The service forwards the URL to the configured STT provider and waits for the result.

**Request:**

- Method: `POST`
- Headers:
  - `Content-Type: application/json`
- Body: JSON object with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audioUrl` | string | **Yes** | Public HTTP(S) URL to the audio file. Must start with `http://` or `https://`. |
| `provider` | string | No | STT provider name (e.g., `assemblyai`). Defaults to `STT_DEFAULT_PROVIDER` if not specified. |
| `restorePunctuation` | boolean | No | Whether to restore punctuation in the transcription. Default: `true`. |
| `language` | string | No | Source language code for transcription (e.g., `en`, `es`, `fr`). See provider documentation for supported languages. Value is trimmed before sending to provider. |
| `formatText` | boolean | No | Whether to format the transcribed text. Default: `false`. |
| `apiKey` | string | No | Provider API key. If not provided, uses `ASSEMBLYAI_API_KEY` from environment. |

**Request Example:**
```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "provider": "assemblyai",
  "restorePunctuation": true,
  "language": "en",
  "formatText": true,
  "apiKey": "YOUR_ASSEMBLYAI_KEY"
}
```

**Response:**

**Success (200 OK):**
```json
{
  "text": "Transcribed text content goes here.",
  "provider": "assemblyai",
  "requestId": "unique-request-id",
  "durationSec": 120.5,
  "language": "en",
  "confidenceAvg": 0.95,
  "wordsCount": 234,
  "processingMs": 5432,
  "punctuationRestored": true,
  "raw": {
    // Raw response from the provider (structure varies by provider)
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Transcribed text. |
| `provider` | string | Name of the STT provider used. |
| `requestId` | string | Unique identifier for this transcription request. |
| `durationSec` | number (optional) | Duration of the audio file in seconds. |
| `language` | string (optional) | Detected or specified source language. |
| `confidenceAvg` | number (optional) | Average confidence score (0-1). |
| `wordsCount` | number (optional) | Number of words in the transcription. |
| `processingMs` | number | Total processing time in milliseconds. |
| `punctuationRestored` | boolean | Whether punctuation was restored. |
| `raw` | object | Raw response from the provider (for debugging/advanced use). |

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/v1/transcribe \
  -H 'Content-Type: application/json' \
  -d '{
    "audioUrl": "https://example.com/audio.mp3",
    "provider": "assemblyai",
    "restorePunctuation": true,
    "language": "en",
    "formatText": true,
    "apiKey": "YOUR_ASSEMBLYAI_KEY"
  }'
```

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "statusCode": 400,
  "timestamp": "2025-12-23T12:34:56.789Z",
  "path": "/api/v1/transcribe",
  "method": "POST",
  "message": "Human-readable error message",
  "error": {
    // Additional error details (varies by error type)
  }
}
```

### Common Error Codes

#### 400 Bad Request

Returned when the request is invalid or violates constraints.

**Common scenarios:**

1. **Invalid URL:**
```json
{
  "statusCode": 400,
  "message": "audioUrl must be a valid URL",
  "error": "BadRequestException"
}
```

2. **Non-HTTP(S) protocol:**
```json
{
  "statusCode": 400,
  "message": "Only http(s) URLs are allowed",
  "error": "BadRequestException"
}
```

3. **Private/loopback host:**
```json
{
  "statusCode": 400,
  "message": "Private/loopback hosts are not allowed",
  "error": "BadRequestException"
}
```
*Blocked hosts include: `localhost`, `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, IPv6 loopback, link-local addresses.*

4. **File too large:**
```json
{
  "statusCode": 400,
  "message": "File too large",
  "error": "BadRequestException"
}
```
*Returned when `Content-Length` header exceeds `STT_MAX_FILE_SIZE_MB`. If the header is missing, size check is skipped.*

5. **Unsupported provider:**
```json
{
  "statusCode": 400,
  "message": "Unsupported provider",
  "error": "BadRequestException"
}
```
*Returned when the requested provider is not in `STT_ALLOWED_PROVIDERS` or not registered.*

6. **Validation errors:**
```json
{
  "statusCode": 400,
  "message": "audioUrl must start with http or https",
  "error": {
    "statusCode": 400,
    "message": ["audioUrl must start with http or https"],
    "error": "Bad Request"
  }
}
```

#### 401 Unauthorized

Returned when authentication fails.

**Missing API key:**
```json
{
  "statusCode": 401,
  "message": "Missing provider API key",
  "error": "UnauthorizedException"
}
```
*Occurs when neither `apiKey` in request body nor `ASSEMBLYAI_API_KEY` environment variable is set.*

#### 404 Not Found

Returned when the requested endpoint does not exist.

```json
{
  "statusCode": 404,
  "message": "Cannot GET /api/v1/nonexistent",
  "error": "NotFoundException"
}
```

#### 499 Client Closed Request

Returned when the client closes the connection before the request completes.

```json
{
  "statusCode": 499,
  "message": "CLIENT_CLOSED_REQUEST",
  "error": "HttpException"
}
```

#### 500 Internal Server Error

Returned when an unexpected error occurs on the server.

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "InternalServerErrorException"
}
```

#### 504 Gateway Timeout

Returned when transcription takes longer than `STT_MAX_SYNC_WAIT_MINUTES`.

```json
{
  "statusCode": 504,
  "message": "TRANSCRIPTION_TIMEOUT",
  "error": "GatewayTimeoutException"
}
```

---

## Security & Validation

### SSRF Protection

The service blocks requests to private and loopback addresses to prevent Server-Side Request Forgery (SSRF) attacks:

- **Blocked IPv4 ranges:**
  - `127.0.0.0/8` (loopback)
  - `10.0.0.0/8` (private)
  - `172.16.0.0/12` (private)
  - `192.168.0.0/16` (private)
  - `169.254.0.0/16` (link-local)

- **Blocked IPv6 ranges:**
  - `::1/128` (loopback)
  - `fe80::/10` (link-local)
  - `fc00::/7` (unique local)

- **Blocked hostnames:**
  - `localhost`

### File Size Validation

- The service performs a pre-flight `HEAD` request to check the `Content-Length` header.
- If the header is present and exceeds `STT_MAX_FILE_SIZE_MB`, the request is rejected with `400 File too large`.
- If the header is missing or the `HEAD` request fails, the size check is skipped.

### URL Validation

- Only `http://` and `https://` protocols are allowed.
- URLs must be valid and parseable.

### Provider Validation

- If `STT_ALLOWED_PROVIDERS` is set, only providers in the list are allowed.
- If empty or unset, all registered providers are allowed.

---

## Timeouts & Limits

| Parameter | Environment Variable | Default | Description |
|-----------|---------------------|---------|-------------|
| Request timeout | `STT_REQUEST_TIMEOUT_SECONDS` | 30 | Timeout for individual HTTP requests to the provider. |
| Polling interval | `STT_POLL_INTERVAL_MS` | 1000 | Interval between status checks when waiting for results. |
| Max sync wait | `STT_MAX_SYNC_WAIT_MINUTES` | 10 | Maximum time to wait for transcription before returning `504`. |
| Max file size | `STT_MAX_FILE_SIZE_MB` | 100 | Maximum allowed file size (checked via `Content-Length`). |
| Graceful shutdown | `GRACEFUL_SHUTDOWN_TIMEOUT_MS` | 25000 | Time to wait for active requests during shutdown. |

---

## Source Language Support

The `language` parameter is trimmed and passed directly to the provider. Supported source languages depend on the provider.

**AssemblyAI supported languages:**
- See official documentation: https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages

**Common language codes:**
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `nl` - Dutch
- `hi` - Hindi
- `ja` - Japanese
- And many more...

---

## Request Flow

1. **Validation:**
   - URL format and protocol
   - SSRF protection (private/loopback hosts)
   - Provider availability

2. **Pre-flight check (optional):**
   - `HEAD` request to check `Content-Length`
   - Reject if file size exceeds limit

3. **Provider selection:**
   - Use `provider` from request or `STT_DEFAULT_PROVIDER`
   - Validate against `STT_ALLOWED_PROVIDERS`

4. **API key resolution:**
   - Use `apiKey` from request or `ASSEMBLYAI_API_KEY` from environment
   - Return `401` if neither is available

5. **Transcription:**
   - Submit audio URL to provider
   - Poll for results at `STT_POLL_INTERVAL_MS` intervals
   - Return `504` if exceeds `STT_MAX_SYNC_WAIT_MINUTES`

6. **Response:**
   - Return transcription result with metadata

---

## Notes

- The service does **not** download audio files. It forwards the original URL to the provider.
- The `HEAD` request for size checking may fail or be blocked by some servers. In such cases, the size check is skipped.
- The service has **no built-in authentication**. Provider API keys are supplied in the request body or via environment variables.
- All logs are structured JSON in production (via Pino).
- Sensitive headers (`authorization`, `x-api-key`) are redacted from logs.
- The `/health` endpoint is excluded from request logging in production.

---

## Examples

### Minimal request (using environment API key)

```bash
curl -X POST http://localhost:8080/api/v1/transcribe \
  -H 'Content-Type: application/json' \
  -d '{"audioUrl": "https://example.com/audio.mp3"}'
```

### Full request with all options

```bash
curl -X POST http://localhost:8080/api/v1/transcribe \
  -H 'Content-Type: application/json' \
  -d '{
    "audioUrl": "https://example.com/audio.mp3",
    "provider": "assemblyai",
    "restorePunctuation": true,
    "language": "en",
    "formatText": true,
    "apiKey": "YOUR_ASSEMBLYAI_KEY"
  }'
```

### Health check

```bash
curl http://localhost:8080/api/v1/health
```

### With BASE_PATH

```bash
# If BASE_PATH=voice-gateway
curl http://localhost:8080/voice-gateway/api/v1/health
curl -X POST http://localhost:8080/voice-gateway/api/v1/transcribe \
  -H 'Content-Type: application/json' \
  -d '{"audioUrl": "https://example.com/audio.mp3"}'
```
