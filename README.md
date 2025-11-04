# STT Gateway Microservice (NestJS + Fastify)

High-performance microservice for synchronous speech-to-text by public audio URL. Built with NestJS + Fastify. Uses AssemblyAI by default. No built-in auth, Swagger, or GraphQL.

Links:

- API: see [API documentation](docs/API.md)
- Dev guide: see [Development guide](docs/dev.md) (link duplicated at the bottom)

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

- Service: `http://localhost:80/api/v1`
- Docker Compose: `http://localhost:8080/api/v1`

## Environment

- Files:
  - `.env.production`
  - `.env.development`
- Source of truth: `.env.production.example`

Core variables:

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — e.g. `0.0.0.0` or `localhost`
- `LISTEN_PORT` — e.g. `80` or `3000`
- `API_BASE_PATH` — API prefix (default `api`)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — timezone (default `UTC`)
- `HTTP_REQUEST_BODY_LIMIT_MB` — max HTTP request body size (MB) for Fastify body parser (default `100`)

STT variables:

- `STT_DEFAULT_PROVIDER` — default provider (e.g., `assemblyai`)
- `STT_ALLOWED_PROVIDERS` — comma-separated allow list (e.g., `assemblyai`)
- `STT_MAX_FILE_SIZE_MB` — file size limit in MB (checked via `Content-Length` on HEAD)
- `STT_REQUEST_TIMEOUT_SECONDS` — single HTTP request timeout to provider
- `STT_POLL_INTERVAL_MS` — polling interval in milliseconds when waiting for result
- `STT_MAX_SYNC_WAIT_MINUTES` — max synchronous wait before returning `504`
- `ASSEMBLYAI_API_KEY` — optional default provider key (used if request has no `apiKey`)

## API

- See [API documentation](docs/API.md) for complete endpoint reference, requests/responses, and status codes.

Quick summary of available endpoints:

- `GET /{API_BASE_PATH}/v1/health` — health check
- `POST /{API_BASE_PATH}/v1/transcriptions/file` — synchronous transcription by audio URL

### Transcription behavior (high level)

- The service does not download audio files; it forwards the original URL to the provider.
- Pre-flight HEAD may be performed to check size via `Content-Length`.
  - If present and exceeds `STT_MAX_FILE_SIZE_MB` → `400 File too large`.
  - If missing/unavailable → size check is skipped.
- Timeouts and waiting:
  - Request timeout: `STT_REQUEST_TIMEOUT_SECONDS`.
  - Polling interval: `STT_POLL_INTERVAL_MS`.
  - Max sync wait: `STT_MAX_SYNC_WAIT_MINUTES` → returns `504` if exceeded.

## Docker

- Image exposes internal port `80`; compose maps `8080:80` by default.
- Minimal flow:

```bash
pnpm install && pnpm build
docker compose -f docker/docker-compose.yml up -d --build
```

`docker run` example:

```bash
docker run -d \
  -p 8080:80 \
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

## Notes

- No Swagger or GraphQL included
- No built-in authorization

---

See also: [Development guide](docs/dev.md).

## License

MIT
