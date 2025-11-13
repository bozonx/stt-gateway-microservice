# CHANGELOG

## Unreleased

### Configuration

- Removed environment variable `HTTP_REQUEST_BODY_LIMIT_MB`. Fastify body parser limit is now fixed to `100 MB`.
- Unified default HTTP port to `8080` across development and production:
  - Default `LISTEN_PORT` is now `8080` in config
  - `.env.production.example` and `.env.development.example` set to `8080`
  - Dockerfile `EXPOSE 8080` and `ENV LISTEN_PORT=8080`
  - docker-compose maps `8080:8080` and healthcheck targets `:8080`
  - Documentation updated (README, docs/API.md, docs/dev.md)

### API changes

- Added optional request parameter `restorePunctuation` (default `true` when supported) to `/transcribe`
- Response now always includes `punctuationRestored` boolean
- Removed `textFormatted` from documentation (not supported)

- Added optional request parameter `language` to `/transcribe` to explicitly set audio language (e.g., `en`, `ru`, `en-US`). Providers use auto-detect when omitted and supported.

- API_VERSION удалена из кода, тестов и документации; версия API зафиксирована как `v1`
- AppConfig больше не содержит `apiVersion`; глобальный префикс формируется как `/{API_BASE_PATH}/v1`
- README: переписан на английском и ориентирован на production; dev‑инструкции оставлены в `docs/dev.md`; примеры и эндпоинты верифицированы по коду
- Источник истины env: подтверждено `.env.production.example`; добавлено упоминание `TZ`
- Удалён флаг `ALLOW_CUSTOM_API_KEY`; передача `apiKey` в запросе теперь всегда разрешена (BYO ключ по умолчанию)
- Обновлены `env.production.example` и `env.development.example` (убраны `ALLOW_CUSTOM_API_KEY`, уточнён `ASSEMBLYAI_API_KEY` как fallback)
- Удалён корневой эндпоинт индекса `GET /` (ранее `/{API_BASE_PATH}/v1`), обновлены тесты и документация

### Security & Logging

- Masked sensitive data in logs: the service and provider no longer log full `audioUrl`; only `hostname` is recorded where applicable.
- Improved error logging to include concise error messages instead of full objects; HEAD‑size check failures now log only the error message.

### n8n Nodes

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

- Удалены GraphQL и Swagger
- Удалена встроенная авторизация (Bearer Auth)
- Сохранён функционал STT (модуль транскрипции и провайдер AssemblyAI)
- Упрощены конфиги окружения (`.env.*`)
- Обновлён `AppModule` и логирование
- Тесты пересобраны; auth-тесты отключены
- Переработан `docker-compose.yml` до минимального примера (локальная сборка)
- Обновлён `README.md` (рус.)
- Актуализирована документация в `docs/` (ENV, dev)
