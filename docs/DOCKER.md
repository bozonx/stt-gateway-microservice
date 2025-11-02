# Руководство по развёртыванию в Docker

## Обзор

Микросервис предоставляет REST API для синхронной транскрибации аудио. 

- Внутренний порт контейнера: 80
- Рекомендуемый внешний порт: 8080
- Базовый образ: Node.js 22 (Alpine)
- Без встроенной авторизации, Swagger, GraphQL и rate limiting

## Предварительные требования

- Docker 24+
- Docker Compose v2

## Быстрый старт с docker-compose

1) Соберите приложение (Dockerfile ожидает наличие `dist/`):

```bash
pnpm install
pnpm build
```

2) Запустите сервис:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

3) Проверьте статус:

```bash
# Health
curl http://localhost:8080/api/v1/health

# Индекс API
curl http://localhost:8080/api/v1
```

4) Логи и управление:

```bash
docker compose logs -f
docker compose ps
docker compose restart
docker compose down
```

### Переменные окружения (контейнер)

- Базовые:
  - `NODE_ENV` (например, `production`)
  - `LISTEN_HOST` (например, `0.0.0.0`)
  - `LISTEN_PORT` (например, `80`)
  - `TZ` (например, `UTC`)
- API:
  - `API_BASE_PATH` (по умолчанию `api`)
  - `API_VERSION` (по умолчанию `v1`)
- Логи:
  - `LOG_LEVEL` (`trace|debug|info|warn|error|fatal|silent`)
- STT:
  - `STT_DEFAULT_PROVIDER` (по умолчанию `assemblyai`)
  - `STT_ALLOWED_PROVIDERS` (по умолчанию `assemblyai`)
  - `STT_MAX_FILE_SIZE_MB` (по умолчанию `100`)
  - `STT_REQUEST_TIMEOUT_SEC` (по умолчанию `15`)
  - `STT_POLL_INTERVAL_MS` (по умолчанию `1500`)
  - `STT_MAX_SYNC_WAIT_MIN` (по умолчанию `3`)
  - `ALLOW_CUSTOM_API_KEY` (`false|true`)
  - `ASSEMBLYAI_API_KEY` (необязателен, но обязателен если `ALLOW_CUSTOM_API_KEY=false` и вы не передаёте `apiKey` в запросе)

Примечание: переменных `AUTH_*` нет — встроенная авторизация удалена.

### Файл docker-compose.yml

Пример находится в `docker/docker-compose.yml`. Он маппит порт `8080:80` и содержит healthcheck, проверяющий `/api/v1/health`.

Если вам нужна локальная сборка вместо готового образа — добавьте секцию `build` и убедитесь, что `dist/` собран:

```yaml
services:
  stt-gateway-microservice:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "8080:80"
    environment:
      - API_BASE_PATH=api
      - API_VERSION=v1
      - LOG_LEVEL=warn
      # Укажите ключ провайдера, если не используете custom apiKey в запросе
      - ASSEMBLYAI_API_KEY=your-assemblyai-key
    restart: unless-stopped
```

## Запуск через docker run

Минимальный пример:

```bash
docker run -d \
  -p 8080:80 \
  -e NODE_ENV=production \
  -e API_BASE_PATH=api \
  -e API_VERSION=v1 \
  -e LOG_LEVEL=warn \
  -e ASSEMBLYAI_API_KEY=your-assemblyai-key \
  --name stt-gateway \
  your-image:tag
```

Если `ALLOW_CUSTOM_API_KEY=true`, можно не задавать `ASSEMBLYAI_API_KEY` и передавать ключ в теле запроса (`apiKey`).

## Healthcheck

В docker-compose включён healthcheck, который:

- Пингует `http://127.0.0.1:{LISTEN_PORT}/{API_BASE_PATH}/{API_VERSION}/health`
- Отмечает контейнер `unhealthy`, если ответ не `200`

## Troubleshooting

- 401 при транскрибации: проверьте, что задан `ASSEMBLYAI_API_KEY` (или используете `ALLOW_CUSTOM_API_KEY=true` и передаёте `apiKey`).
- 400 `Private/loopback hosts are not allowed`: источник аудио должен быть доступным публично, приватные и loopback-хосты блокируются.
- 400 `File too large`: превышен лимит `STT_MAX_FILE_SIZE_MB` (проверяется, если сервер источника отдаёт `Content-Length`).
- Конфликт портов: измените маппинг порта в compose (`ports: ['8081:80']`).

## Рекомендации для production

- Используйте стабильные версии образов/тегов.
- Логируйте в JSON (`NODE_ENV=production`, `LOG_LEVEL=warn|error`).
- Ограничьте ресурсы контейнера и настройте агрегацию логов (ELK, Loki и т.д.).
