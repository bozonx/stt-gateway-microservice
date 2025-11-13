# STT Gateway Microservice (NestJS + Fastify)

High-performance microservice for synchronous speech-to-text from a public audio URL.
Built with NestJS + Fastify. Uses AssemblyAI by default. No built-in auth, Swagger, or GraphQL.

Links:

- API: see [API documentation](docs/API.md)
- Dev guide: see [Development guide](docs/dev.md) (link duplicated at the bottom)

## Table of contents

- [What's included](#whats-included)
- [Quick Start (production)](#quick-start-production)
- [Quick Start (development)](#quick-start-development)
- [Environment](#environment)
- [API](#api)
- [Usage examples](#usage-examples)
- [Security](#security)
- [Docker](#docker)
- [Logging](#logging)
- [n8n integration](#n8n-integration)
- [Notes](#notes)
- [License](#license)

## What's included

- 🏥 Minimal health-check endpoint `/{API_BASE_PATH}/v1/health`
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
cp env.production.example .env.production
pnpm build
pnpm start:prod
```

Default URLs:

- Service: `http://localhost:8080/api/v1`
- Docker Compose: `http://localhost:8080/api/v1`

## Quick Start (development)

```bash
pnpm install
cp env.development.example .env.development
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
- `API_BASE_PATH` — API prefix (default `api`)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — timezone (default `UTC`)

STT variables:

- `STT_DEFAULT_PROVIDER` — default provider (e.g., `assemblyai`)
- `STT_ALLOWED_PROVIDERS` — comma-separated allow list (e.g., `assemblyai`).
  If empty or unset, all registered providers are allowed.
- `STT_MAX_FILE_SIZE_MB` — file size limit in MB (checked via `Content-Length` on HEAD)
- `STT_REQUEST_TIMEOUT_SECONDS` — single HTTP request timeout to provider
- `STT_POLL_INTERVAL_MS` — polling interval in milliseconds when waiting for result
- `STT_MAX_SYNC_WAIT_MINUTES` — max synchronous wait before returning `504`
- `ASSEMBLYAI_API_KEY` — optional default provider key (used if request has no `apiKey`)

## API

- See [API documentation](docs/API.md) for complete endpoint reference, requests/responses, and status codes.

Quick summary of available endpoints:

- `GET /{API_BASE_PATH}/v1/health` — health check
- `POST /{API_BASE_PATH}/v1/transcribe` — synchronous transcription by audio URL

### Transcription behavior (high level)

- The service does not download audio files; it forwards the original URL to the provider.
- Pre-flight HEAD may be performed to check size via `Content-Length`.
  - If present and exceeds `STT_MAX_FILE_SIZE_MB` → `400 File too large`.
  - If missing/unavailable → size check is skipped.
- Timeouts and waiting:
  - Request timeout: `STT_REQUEST_TIMEOUT_SECONDS`.
  - Polling interval: `STT_POLL_INTERVAL_MS`.
  - Max sync wait: `STT_MAX_SYNC_WAIT_MINUTES` → returns `504` if exceeded.

## Usage examples

- Health check

```bash
curl http://localhost:8080/api/v1/health
```

- Transcription request

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
    "apiKey": "YOUR_ASSEMBLYAI_KEY"
  }'
```

Notes:
- The `language` value is trimmed and sent to the provider as-is. See AssemblyAI's supported languages: https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages.

See [API documentation](docs/API.md) for full details.

## Security

- SSRF protection: private and loopback hosts are rejected (`localhost`, `127.0.0.1`, `10.0.0.0/8`, `172.16/12`, `192.168/16`, link-local, IPv6 loopback/link-local).
- Only HTTP(S) `audioUrl` are allowed.
- Optional pre-flight HEAD checks `Content-Length` and rejects files larger than `STT_MAX_FILE_SIZE_MB` (when header is present).
- The service has no built-in authentication; provider API key is supplied in request body as `apiKey` or via `ASSEMBLYAI_API_KEY`.

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
  -e API_BASE_PATH=api \
  -e LOG_LEVEL=warn \
  -e ASSEMBLYAI_API_KEY=your-assemblyai-key \
  --name stt-gateway \
  your-image:tag
```

Healthcheck in compose pings `/{API_BASE_PATH}/v1/health`.

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

- 400 Invalid URL — Ensure `audioUrl` starts with `http` or `https`.
- 400 Private/loopback host — Use only public hosts.
- 400 File too large — The origin returned `Content-Length` above `STT_MAX_FILE_SIZE_MB`.
- 401 Missing provider API key — Pass `apiKey` or set `ASSEMBLYAI_API_KEY`.
- 504 Gateway Timeout — Increase `STT_MAX_SYNC_WAIT_MINUTES` or check provider availability.

---

See also: [Development guide](docs/dev.md).

## License

MIT
