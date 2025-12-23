# STT Gateway Microservice (NestJS + Fastify)

High-performance microservice for synchronous speech-to-text from a public audio URL.
Built with NestJS + Fastify. Uses AssemblyAI by default. No built-in auth, Swagger, or GraphQL.

Links:

- API: see [API](#api) section below
- Dev guide: see [Development guide](docs/dev.md) (link duplicated at the bottom)

## Table of contents

- [What's included](#whats-included)
- [Quick Start (production)](#quick-start-production)
- [Quick Start (development)](#quick-start-development)
- [Environment](#environment)
- [API](#api)
- [Security](#security)
- [Docker](#docker)
- [Logging](#logging)
- [n8n integration](#n8n-integration)
- [Notes](#notes)
- [License](#license)

## What's included

- 🏥 Minimal health-check endpoint `/{BASE_PATH}/api/v1/health` (leave empty if no BASE_PATH)
- 📊 Structured logging via Pino (JSON in production)
- 🛡️ Global error filter
- ⚡ Fastify runtime
- 🧪 Ready-to-use Jest tests (unit and e2e)
- 🐳 Docker-ready
- 🎙️ Synchronous transcription endpoint via AssemblyAI

## Quick Start (production)

Choose one of the options below.

- Docker Compose (recommended):

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

- Run from source:

```bash
pnpm install
cp .env.production.example .env.production
pnpm build
pnpm start:prod
```

Default URLs:

- Service: `http://localhost:8080/api/v1`
- Docker Compose: `http://localhost:8080/api/v1`

## Quick Start (development)

```bash
pnpm install
cp .env.development.example .env.development
pnpm start:dev
```

- Default dev URL: `http://localhost:8080/api/v1`
- See [Development guide](docs/dev.md) for scripts, debugging, tests, and structure.

## Environment

- Files:
  - `.env.production`
  - `.env.development`
- Source of truth: `.env.production.example`

Core variables:

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — e.g. `0.0.0.0` or `localhost`
- `LISTEN_PORT` — e.g. `8080`
- `BASE_PATH` — optional URL prefix (e.g. `voice-gateway`)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — timezone (default `UTC`)

STT variables:

- `DEFAULT_PROVIDER` — default provider (e.g., `assemblyai`)
- `ALLOWED_PROVIDERS` — comma-separated allow list (e.g., `assemblyai`).
  If empty or unset, all registered providers are allowed.
- `MAX_FILE_SIZE_MB` — file size limit in MB (checked via `Content-Length` on HEAD)
- `PROVIDER_API_TIMEOUT_SECONDS` — single HTTP request timeout to provider
- `POLL_INTERVAL_MS` — polling interval in milliseconds when waiting for result
- `DEFAULT_MAX_WAIT_MINUTES` — max synchronous wait before returning `504`
- `MAX_RETRIES` — maximum number of retries for the initial submit request (default: 3)
- `RETRY_DELAY_MS` — delay between retries in milliseconds (default: 1500)
- `ASSEMBLYAI_API_KEY` — optional default provider key (used if request has no `apiKey`)

## API

This section provides a complete reference for all API endpoints, request/response formats, and status codes.

### Base URL

All endpoints are prefixed with:

```
/{BASE_PATH}/api/v1
```

Where `{BASE_PATH}` is an optional URL prefix configured via the `BASE_PATH` environment variable. If `BASE_PATH` is empty, the base URL is simply `/api/v1`.

**Examples:**
- With `BASE_PATH=voice-gateway`: `http://localhost:8080/voice-gateway/api/v1`
- Without `BASE_PATH` (empty): `http://localhost:8080/api/v1`

---

### Endpoints

#### 1. Health Check

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

#### 2. Transcribe Audio

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
| `provider` | string | No | STT provider name (e.g., `assemblyai`). Defaults to `DEFAULT_PROVIDER` if not specified. |
| `restorePunctuation` | boolean | No | Whether to restore punctuation in the transcription. Default: `true`. |
| `language` | string | No | Source language code for transcription (e.g., `en`, `es`, `fr`). See provider documentation for supported languages. Value is trimmed before sending to provider. |
| `formatText` | boolean | No | Whether to format the transcribed text. Default: `false`. |
| `apiKey` | string | No | Provider API key. If not provided, uses `ASSEMBLYAI_API_KEY` from environment. |
| `maxWaitMinutes` | number | No | Override max synchronous wait time in minutes. |

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

### Error Responses

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

#### Common Error Codes

- **400 Bad Request**: Invalid URL, private host, file too large, or unsupported provider.
- **401 Unauthorized**: Missing or invalid provider API key.
- **404 Not Found**: Endpoint does not exist.
- **499 Client Closed Request**: Client closed the connection before the request completed.
- **500 Internal Server Error**: Unexpected error on the server.
- **504 Gateway Timeout**: Transcription took longer than `DEFAULT_MAX_WAIT_MINUTES`.

---

### Timeouts & Limits

| Parameter | Environment Variable | Default | Description |
|-----------|---------------------|---------|-------------|
| Request timeout | `PROVIDER_API_TIMEOUT_SECONDS` | 30 | Timeout for individual HTTP requests to the provider. |
| Polling interval | `POLL_INTERVAL_MS` | 1000 | Interval between status checks when waiting for results. |
| Max sync wait | `DEFAULT_MAX_WAIT_MINUTES` | 10 | Maximum time to wait for transcription before returning `504`. |
| Max file size | `MAX_FILE_SIZE_MB` | 100 | Maximum allowed file size (checked via `Content-Length`). |
| Graceful shutdown | `GRACEFUL_SHUTDOWN_TIMEOUT_MS` | 25000 | Time to wait for active requests during shutdown. |

---

### Request Flow

1. **Validation:** URL format, protocol, and SSRF protection (private/loopback hosts).
2. **Pre-flight check (optional):** `HEAD` request to check `Content-Length`.
3. **Provider selection:** Use `provider` from request or `DEFAULT_PROVIDER`.
4. **API key resolution:** Use `apiKey` from request or `ASSEMBLYAI_API_KEY` from environment.
5. **Transcription:** Submit audio URL to provider and poll for results until completion or timeout.
6. **Response:** Return transcription result with metadata.


## Security

The service implements several layers of security and validation:

### SSRF Protection

To prevent Server-Side Request Forgery (SSRF) attacks, the service blocks requests to private and loopback addresses:

- **Blocked IPv4 ranges:** `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`.
- **Blocked IPv6 ranges:** `::1/128`, `fe80::/10`, `fc00::/7`.
- **Blocked hostnames:** `localhost`.

### Validation

- **URL Validation:** Only `http://` and `https://` protocols are allowed.
- **File Size Validation:** Pre-flight `HEAD` request checks `Content-Length`. If it exceeds `MAX_FILE_SIZE_MB`, the request is rejected with `400 Bad Request`.
- **Provider Validation:** If `ALLOWED_PROVIDERS` is set, only listed providers are allowed.
- **Authentication:** The service has no built-in auth; provider API keys are supplied in the request body or via environment variables.

## Docker

- Image exposes internal port `8080`; compose maps `8080:8080` by default.
- Minimal flow:

```bash
pnpm install && pnpm build
docker compose -f docker/docker-compose.yml up -d --build
```

`docker run` example:

```bash
docker run -d \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e BASE_PATH= \
  -e LOG_LEVEL=warn \
  -e ASSEMBLYAI_API_KEY=your-assemblyai-key \
  --name stt-gateway \
  your-image:tag
```

- `GET /{BASE_PATH}/api/v1/health` — health check
- `POST /{BASE_PATH}/api/v1/transcribe` — synchronous transcription by audio URL

### Graceful Shutdown

The service implements proper graceful shutdown:

- On `SIGTERM`/`SIGINT`: stops accepting new connections, waits for active requests to complete
- Timeout: 25 seconds (configurable via `GRACEFUL_SHUTDOWN_TIMEOUT_MS` constant)
- Fastify forcefully closes any remaining connections after timeout
- Docker `stop_grace_period`: 30 seconds (allows 5s buffer for cleanup)

## Logging

`nestjs-pino` is used for structured logs.

- Dev: pretty output via `pino-pretty`
- Prod: JSON logs with `@timestamp`, `service`, `environment`
- Redaction: `authorization`, `x-api-key` headers
- Auto-logging ignores `/health` in production

Adjust verbosity with `LOG_LEVEL`.

## n8n integration

- Community node: `n8n-nodes-bozonx-stt-gateway-microservice` (see package in this repo).
- Use `Bozonx Microservices API` credentials with:
  - Gateway URL (without trailing slash), e.g., `https://api.example.com`
  - Optional API Token: adds `Authorization: Bearer <token>` if provided
- The node calls `POST {{gatewayUrl}}/{{basePath}}/transcribe` with the same JSON body as the REST API.
- See the node’s [README](n8n-nodes-bozonx-stt-gateway-microservice/README.md) for details.

## Notes

- No Swagger or GraphQL included
- No built-in authorization

## Troubleshooting

- **400 Invalid URL:** Ensure `audioUrl` starts with `http` or `https`.
- **400 Private/loopback host:** Use only public hosts.
- **400 File too large:** The origin returned `Content-Length` above `MAX_FILE_SIZE_MB`.
- **401 Missing provider API key:** Pass `apiKey` or set `ASSEMBLYAI_API_KEY`.
- **504 Gateway Timeout**: Increase `DEFAULT_MAX_WAIT_MINUTES` or check provider availability.
- **Source Language:** If transcription is inaccurate, ensure the correct `language` code is provided. See [AssemblyAI languages](https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages).

## Development

- Requirements: Node.js 22+, pnpm 10+
- Dev quick start:

```bash
pnpm install
cp .env.development.example .env.development
pnpm start:dev
```

- Tests: `pnpm test`, `pnpm test:unit`, `pnpm test:e2e`
- Code quality: `pnpm lint`, `pnpm format`
- For project structure, debugging tips, and provider extension details, see the full [Development guide](docs/dev.md).

## License

MIT
