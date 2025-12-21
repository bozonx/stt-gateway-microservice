# CHANGELOG

## 0.16.0 — Release

### Configuration

- Removed environment variable `HTTP_REQUEST_BODY_LIMIT_MB`. Fastify body parser limit is now fixed to `100 MB`.
- Unified default HTTP port to `8080` across development and production:
  - Default `LISTEN_PORT` is now `8080` in config
  - `.env.production.example` and `.env.development.example` set to `8080`
  - Dockerfile `EXPOSE 8080` and `ENV LISTEN_PORT=8080`
  - docker-compose maps `8080:8080` and healthcheck targets `:8080`
  - Documentation updated (README, docs/API.md, docs/dev.md)

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
- Added `docs/API.md` with endpoint reference, examples, and status codes (English)
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
