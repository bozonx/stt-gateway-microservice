# CHANGELOG

## Unreleased

### API changes

- Added optional request parameter `restorePunctuation` (default `true` when supported) to `/transcriptions/file`
- Response now always includes `punctuationRestored` boolean
- Removed `textFormatted` from documentation (not supported)

- API_VERSION удалена из кода, тестов и документации; версия API зафиксирована как `v1`
- AppConfig больше не содержит `apiVersion`; глобальный префикс формируется как `/{API_BASE_PATH}/v1`
- README: переписан на английском и ориентирован на production; dev‑инструкции оставлены в `docs/dev.md`; примеры и эндпоинты верифицированы по коду
- Документация: добавлены `docs/DOCKER.md` и `docs/LOGGING.md` (адаптация под текущий код)
- Документация: `docs/ENV_SETUP.md` и `docs/dev.md` вычитаны и оставлены актуальными
- Docker Compose: пример использует внешний образ, инструкции по локальной сборке перенесены в `docs/DOCKER.md`
- package.json: имя пакета — `stt-gateway-microservice`; версии зависимостей оставлены без изменений
- Источник истины env: подтверждено `.env.production.example`; добавлено упоминание `TZ`
 - Удалён флаг `ALLOW_CUSTOM_API_KEY`; передача `apiKey` в запросе теперь всегда разрешена (BYO ключ по умолчанию)
 - Обновлены `env.production.example` и `env.development.example` (убраны `ALLOW_CUSTOM_API_KEY`, уточнён `ASSEMBLYAI_API_KEY` как fallback)
 - Обновлены `README.md`, `docs/ENV_SETUP.md`, `docs/DOCKER.md`, `docs/STT.md` в соответствии с новой логикой ключей
- Удалён корневой эндпоинт индекса `GET /` (ранее `/{API_BASE_PATH}/v1`), обновлены тесты и документация

### Documentation refactor (English)

- Consolidated environment, logging, Docker, and STT behavior into `README.md` (English)
- Added `docs/API.md` with endpoint reference, examples, and status codes (English)
- Rewrote `docs/dev.md` in English and moved dev-only content out of `README.md`
- Marked legacy docs for removal: `docs/STT.md`, `docs/LOGGING.md`, `docs/ENV_SETUP.md`, `docs/DOCKER.md`

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
