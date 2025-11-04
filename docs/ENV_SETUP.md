# Настройка окружения

Источник истины: `.env.production.example`.

## Файлы окружения

- `.env.production`
- `.env.development`
- `.env` (fallback)

## Переменные

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — хост, напр. `0.0.0.0` или `localhost`
- `LISTEN_PORT` — порт, напр. `80` или `3000`
- `API_BASE_PATH` — префикс API, напр. `api`
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — таймзона, напр. `UTC`

### STT

- `STT_DEFAULT_PROVIDER` — провайдер по умолчанию, `assemblyai`
- `STT_ALLOWED_PROVIDERS` — список разрешённых провайдеров, `assemblyai`
- `STT_MAX_FILE_SIZE_MB` — лимит размера файла, по умолчанию `100`. Проверяется по заголовку `Content-Length` через `HEAD`; тело файла не скачивается. При отсутствии заголовка проверка пропускается.
- `STT_REQUEST_TIMEOUT_SEC` — таймаут HTTP-запросов к провайдеру, по умолчанию `15`
- `STT_POLL_INTERVAL_MS` — интервал опроса статуса, по умолчанию `1500`
- `STT_MAX_SYNC_WAIT_MIN` — максимальное ожидание синхронной транскрипции, по умолчанию `3`
- `ASSEMBLYAI_API_KEY` — опциональный ключ провайдера; используется как fallback, если в запросе не передан `apiKey`.

## Примечания

- В проекте отсутствуют встроенная авторизация, Swagger и GraphQL.
- Все значения по умолчанию приведены в `.env.production.example`.
