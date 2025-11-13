# Development guide (dev)

## Requirements

- Node.js 22+
- pnpm 10+

## Quick start (dev)

```bash
# 1) Install dependencies
pnpm install

# 2) Environment (dev)
cp env.development.example .env.development

# 3) Start in watch mode
pnpm start:dev
```

- Default URL (dev): `http://localhost:8080/api/v1`

## Tests

Jest projects are split into `unit` and `e2e`.

```bash
# All tests
pnpm test

# Unit tests
pnpm test:unit

# E2E tests
pnpm test:e2e

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov

# Debug
pnpm test:unit:debug
pnpm test:e2e:debug
```

## Code quality

```bash
# Lint
pnpm lint

# Format
pnpm format
```

## Good to know

- Global `ValidationPipe` is enabled with `whitelist`, `forbidNonWhitelisted`, and `transform`.
- Pretty logs in development are provided by `pino-pretty`.
- Autologging of `/health` is disabled in production and enabled in development.
- Sensitive headers are redacted in logs (`authorization`, `x-api-key`).
- TypeScript/Jest path aliases: `@/*`, `@common/*`, `@modules/*`, `@config/*`, `@test/*`.
- API version is fixed to `v1` (not configurable).

## Project structure

```
src/
  app.module.ts
  main.ts
  common/
    constants/
    dto/
    filters/
    interfaces/
  config/
    app.config.ts
    stt.config.ts
  modules/
    health/
    index/
    transcription/
  providers/
    assemblyai/
    stt-provider.registry.ts
  utils/

test/
  setup/
    unit.setup.ts
    e2e.setup.ts
  unit/
  e2e/
```

## Scripts

- `start:dev` — Run Nest in watch mode with `NODE_ENV=development`.
- `start:debug` — Same as above but with the inspector enabled.
- `build` — Compile to `dist/`.
- `start:prod` — Run compiled app with `NODE_ENV=production`.
- `test`, `test:unit`, `test:e2e`, `test:watch`, `test:cov` — Jest test commands.
- `test:unit:debug`, `test:e2e:debug` — Jest in-band with inspector for debugging.
- `lint` — ESLint with auto-fix.
- `format` — Prettier over `src/` and `test/`.

## Environment

- Copy `env.development.example` to `.env.development` for local dev.
- The source of truth for all variables is `env.production.example`.
- Key variables used during development:
  - `API_BASE_PATH` — API prefix (`api` by default). The actual base URL is `/{API_BASE_PATH}/v1`.
  - `LOG_LEVEL` — Set to `trace|debug|info|warn|error|fatal|silent`. For local debugging use `debug`.
  - `STT_*` — Provider selection and limits. See README for details.

Note: Fastify body parser limit is fixed to 100 MB.

## Debugging

- Start the service with `pnpm start:debug` and attach your IDE to the Node inspector.
- Debug Jest with `pnpm test:unit:debug` or `pnpm test:e2e:debug`.
- Pretty logs in dev: ensure `NODE_ENV=development` and optionally set `LOG_LEVEL=debug`.
- Common breakpoints: `transcription.controller.ts`, `transcription.service.ts`, and provider implementation.

## Extending: Add a new STT provider

1) Implement the `SttProvider` interface in `src/common/interfaces/stt-provider.interface.ts`.

2) Create a provider implementation under `src/providers/<provider-name>/` that implements:

   - `submitAndWaitByUrl({ audioUrl, apiKey, restorePunctuation })`
   - Return `TranscriptionResult` fields used by the service.

3) Register the provider in `src/providers/stt-provider.registry.ts` so it is discoverable by name.

4) Update `STT_ALLOWED_PROVIDERS` and `STT_DEFAULT_PROVIDER` as needed.

5) Add unit tests for the provider and update E2E tests if behavior changes.

## Troubleshooting

- 400 Invalid URL — Ensure `audioUrl` starts with `http` or `https` and is a valid URL.
- 400 Private/loopback host — Only public hosts are allowed. Avoid `localhost`, `127.0.0.1`, or private subnets.
- 400 File too large — If the origin returns `Content-Length` exceeding `STT_MAX_FILE_SIZE_MB`, the request is rejected.
- 401 Missing provider API key — Provide `apiKey` in the request or configure `ASSEMBLYAI_API_KEY`.
- 504 Timeout — Increase `STT_MAX_SYNC_WAIT_MINUTES` or verify provider availability.
