# CHANGELOG

## Unreleased

### New
- Added optional `includeWords` request parameter to `/transcribe` and `/transcribe/stream`.
  When enabled, the API returns `words` with word-level timings in milliseconds (provider-dependent).

## 2.2.0 — Code Audit & Performance Improvements

### New
- **Cloudflare Workers Optimization**: Implemented lazy initialization (caching) of the Hono application instance, significantly reducing cold start overhead and memory churn.
- **Structured Logging for Workers**: Replaced plain console logging with a JSON-based logger that matches the **Pino** format (used in Node.js), enabling unified log aggregation.
- **Shared Error Utilities**: Centralized `AbortError` detection logic to reduce duplication across services.

### Improved
- **Error Handling**: 
    - Transcription errors are now better categorized: distinguished between internal system errors (500) and provider/network timeouts (504).
    - Validation errors from Zod are now caught and returned in the global consistent error format (fixing unit tests).
- **Code Style**: Refactored `TranscriptionService` and `TmpFilesService` for better readability and consistent use of `isAbortError`.

## 2.1.0 — Validation & Error Handling Improvements

### New
- Replaced manual request validation with **Zod** and **@hono/zod-validator** middleware for better reliability and declarative schemas.
- Improved error reporting in **AssemblyAI** provider by extracting detailed error messages from API responses.
- Shared validation schemas defined in `src/modules/transcription/transcription.schema.ts`.

## 2.0.0 — Hono Migration (Dual Runtime)

### Breaking Changes
- Migrated from NestJS + Fastify to **Hono** web framework
- Dual runtime support: **Cloudflare Workers** and **Node.js** (Docker)
- Replaced `undici` with standard Web `fetch` API
- Replaced `form-data` + `node:stream` with Web-standard `FormData` / `File` / `Blob`
- Replaced `class-validator` / `class-transformer` with inline request validation
- Replaced `nestjs-pino` with platform-agnostic logger interface (Pino for Node.js, console for Workers)
- Replaced `@nestjs/config` with plain config loader functions
- Node.js entrypoint changed from `dist/src/main.js` to `dist/src/entry-node.js`

### New
- `src/app.ts` — shared Hono app factory (platform-agnostic)
- `src/entry-node.ts` — Node.js entrypoint with `@hono/node-server`
- `src/entry-workers.ts` — Cloudflare Workers entrypoint
- `wrangler.toml` — Cloudflare Workers deployment configuration
- `src/common/errors/http-error.ts` — platform-agnostic HTTP error classes
- `src/common/interfaces/logger.interface.ts` — logger abstraction

### Removed
- All NestJS dependencies (`@nestjs/*`, `reflect-metadata`, `rxjs`)
- `fastify`, `@fastify/multipart`, `undici`, `form-data`, `class-validator`, `class-transformer`
- NestJS modules, controllers, filters, DTOs, injection tokens
- `nest-cli.json`

### Updated
- Dockerfile entrypoint updated to `dist/src/entry-node.js`
- Jest config simplified (removed NestJS path aliases)
- All unit and e2e tests rewritten for plain class instantiation and `app.request()` testing
- README, AGENTS.md updated for Hono stack

## 1.3.1 — AssemblyAI Language Auto-Detection
- When `language` is omitted in `/transcribe` requests, the service now sends `language_detection: true` to AssemblyAI to avoid defaulting to `en_us`.
- Updated documentation and unit tests accordingly.

## 1.3.0 — Graceful Shutdown Implementation
- Implemented proper graceful shutdown handling for SIGTERM and SIGINT signals
- Added `GRACEFUL_SHUTDOWN_TIMEOUT_MS` constant (25 seconds) in `app.constants.ts`
- Configured FastifyAdapter with `forceCloseConnections: true` to prevent hanging connections
- Disabled Fastify `requestTimeout` (`requestTimeout: 0`) to support long-running synchronous `/transcribe` requests
- Added explicit signal handlers in `main.ts` with timeout-based forced shutdown
- Updated `docker-compose.yml` with explicit `stop_signal: SIGTERM`
- Server now stops accepting new connections on shutdown signal and waits for active requests to complete
- After timeout, Fastify forcefully closes remaining connections to prevent hanging
- Added graceful shutdown documentation to README.md

## 1.2.0 — ESM Migration
- Migrated the project to ECMAScript Modules (ESM).
- Added `"type": "module"` to `package.json`.
- Updated TypeScript configuration to use `ESNext` module and `node` resolution.
- Added `tsx` as a dependency to facilitate ESM execution without explicit file extensions in the source.
- Updated npm scripts and Dockerfile to use `node --import tsx`.
- Fixed Jest configuration for ESM support, including global `jest` injection for tests.


## 0.17.0 — Refactor
- Renamed environment variable `API_BASE_PATH` to `BASE_PATH`.
- `BASE_PATH` is now optional and unset by default.
- API endpoints are hardcoded relative to `BASE_PATH` as `/api/v1` (falling back to `api/v1` if `BASE_PATH` is empty).
- Updated configuration, main entry point, and e2e test factory.
- Updated documentation and environment examples.

## 0.16.0 — Release

### Configuration

- Removed environment variable `HTTP_REQUEST_BODY_LIMIT_MB`. Fastify body parser limit is now fixed to `100 MB`.
- Unified default HTTP port to `8080` across development and production:
  - Default `LISTEN_PORT` is now `8080` in config
  - `.env.production.example` and `.env.development.example` set to `8080`
  - Dockerfile `EXPOSE 8080` and `ENV LISTEN_PORT=8080`
  - docker-compose maps `8080:8080` and healthcheck targets `:8080`
  - Documentation updated (README, README.md#api, docs/dev.md)

### API changes

- Removed request parameter `timestamps` from `/transcribe`; word-level data is always available from provider defaults.
- Added optional request parameter `restorePunctuation` (default `true` when supported) to `/transcribe`
- Response now always includes `punctuationRestored` boolean
- Removed `textFormatted` from documentation (not supported)

- Added optional request parameter `language` to `/transcribe` to explicitly set audio language (e.g., `en`, `ru`, `en-US`). Providers use auto-detect when omitted and supported. Value is now trimmed and forwarded to providers without microservice-side validation. See AssemblyAI's supported languages: https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages.

- Removed request parameter `speechModel` from `/transcribe`; AssemblyAI now uses its default model.

- Added optional request parameter `formatText` (default `true`) to `/transcribe` to control text formatting (punctuation, capitalization).
- Removed request parameter `disfluencies` from `/transcribe`; AssemblyAI provider now always uses its default behavior for filler words.

- Removed `API_VERSION` from code, tests, and documentation; API version is fixed to `v1`.
- AppConfig no longer contains `apiVersion`; the global prefix is `/{API_BASE_PATH}/v1`.
- README rewritten in English and focused on production; dev instructions kept in `docs/dev.md`; examples and endpoints verified against code.
- Source of truth for env confirmed as `.env.production.example`; added mention of `TZ`.
- Removed `ALLOW_CUSTOM_API_KEY`; passing `apiKey` in requests is now always allowed (BYO key by default).
- Updated `.env.production.example` and `.env.development.example` (removed `ALLOW_CUSTOM_API_KEY`, clarified `ASSEMBLYAI_API_KEY` as fallback).
- Removed root index endpoint `GET /` (formerly `/{API_BASE_PATH}/v1`); tests and documentation updated.

### Security & Logging

- Masked sensitive data in logs: the service and provider no longer log full `audioUrl`; only `hostname` is recorded where applicable.
- Improved error logging to include concise error messages instead of full objects; HEAD‑size check failures now log only the error message.

### n8n Nodes

- Removed `Timestamps` option from STT Gateway node; AssemblyAI words are returned by default.
- Credentials `Bozonx Microservices API`: `API Token` is now optional. `Authorization: Bearer <token>` header is sent only when token is provided.
- Updated n8n package README to reflect optional token behavior.
- STT Gateway node: default `basePath` set to `api/v1` to match microservice defaults; request URL now built as absolute (no `baseURL` cast workaround). README updated accordingly.
- STT Gateway node: added optional `Language` parameter that passes `language` to the microservice request body.

### Cleanup

- Removed legacy `AuthGuard` and its unit/E2E tests. The service does not include built‑in authorization.

### Documentation refactor (English)

- Consolidated environment, logging, Docker, and STT behavior into `README.md` (English)
- Consolidated API documentation with endpoint reference, examples, and status codes into the main `README.md`
- Rewrote `docs/dev.md` in English and moved dev-only content out of `README.md`
  

## 0.15.0 — Refactor

- Removed GraphQL and Swagger
- Removed built-in authorization (Bearer Auth)
- Kept STT functionality (transcription module and AssemblyAI provider)
- Simplified environment configs (`.env.*`)
- Updated `AppModule` and logging
- Rebuilt tests; auth tests removed
- Simplified `docker-compose.yml` to a minimal example (local build)
- Updated `README.md` (ru)
- Updated documentation in `docs/` (ENV, dev)
