# STT Gateway Microservice (NestJS + Fastify)

High-performance microservice for synchronous speech-to-text by audio URL, built with NestJS + Fastify. Uses AssemblyAI by default. No built-in auth, Swagger, or GraphQL.

## What's included

- 🏥 Minimal health-check endpoint `/{API_BASE_PATH}/{API_VERSION}/health`
- 📊 Structured logging via Pino (JSON in production)
- 🛡️ Global error filter
- ⚡ Fastify runtime
- 🧪 Ready-to-use Jest tests (unit and e2e)
- 🐳 Docker-ready
- 🎙️ Synchronous transcription endpoint via AssemblyAI

## Production Quick Start

Choose one of the options below.

- Docker Compose (recommended for quick run):

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
  - `.env` (optional)
- Source of truth: `.env.production.example`

Key variables:

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — e.g. `0.0.0.0` or `localhost`
- `LISTEN_PORT` — e.g. `80` or `3000`
- `API_BASE_PATH` — API prefix (default `api`)
- `API_VERSION` — API version (default `v1`)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — timezone (default `UTC`)

## Endpoints

- `GET /{API_BASE_PATH}/{API_VERSION}` — API index with service info and links
- `GET /{API_BASE_PATH}/{API_VERSION}/health` — basic health check
- `POST /{API_BASE_PATH}/{API_VERSION}/transcriptions/file` — synchronous transcription by audio URL

Examples

- API index

```bash
curl http://localhost:80/api/v1
```

- Transcription by URL

```bash
curl -X POST \
  http://localhost:80/api/v1/transcriptions/file \
  -H 'Content-Type: application/json' \
  -d '{
    "audioUrl": "https://example.com/audio.mp3",
    "provider": "assemblyai",
    "timestamps": false,
    "apiKey": "YOUR_ASSEMBLYAI_KEY"
  }'
```

Request body

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "provider": "assemblyai",
  "timestamps": false,
  "apiKey": "YOUR_ASSEMBLYAI_KEY"
}
```

Notes:

- `audioUrl` must be http(s); private/loopback hosts are rejected.
- `provider` is optional, defaults to `assemblyai` if omitted and allowed.
- `apiKey` is used only when `ALLOW_CUSTOM_API_KEY=true`; otherwise the service uses `ASSEMBLYAI_API_KEY` from the environment.

Sample response (200 OK)

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
  "timestampsEnabled": false
}
```

Status codes:

- `200 OK` — transcription succeeded
- `400 Bad Request` — invalid params/URL, private hosts, file too large, unsupported provider
- `401 Unauthorized` — missing provider API key (when `ALLOW_CUSTOM_API_KEY=false` and no `ASSEMBLYAI_API_KEY`)
- `503 Service Unavailable` — provider error
- `504 Gateway Timeout` — exceeded max synchronous waiting time

## Tests
See `docs/dev.md` for development and testing instructions.

## Docker

- Example Compose file — `docker/docker-compose.yml`
- To use the provider, either set `ASSEMBLYAI_API_KEY` in the container environment or enable `ALLOW_CUSTOM_API_KEY=true` and supply `apiKey` in the request body.

```bash
# Local run with compose (from repo root)
docker compose -f docker/docker-compose.yml up -d --build
```

See `docs/DOCKER.md` for more details.

## Logging

The service uses `nestjs-pino`:

- Dev: human-readable format via `pino-pretty`
- Prod: JSON logs with `@timestamp` and basic `service`/`environment` fields
- Sensitive headers are redacted: `authorization`, `x-api-key`
- `/health` requests are not logged in production

See `docs/LOGGING.md` for details.

## Notes

- No Swagger or GraphQL included
- No built-in authorization

## License

MIT
