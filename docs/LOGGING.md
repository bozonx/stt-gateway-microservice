# Логирование

Сервис использует `nestjs-pino` для высокопроизводительного структурированного логирования.

- Development: читаемый вывод через `pino-pretty`.
- Production: JSON-логи с полем `@timestamp` и базовыми полями `service`, `environment`.
- Чувствительные заголовки редактируются: `authorization`, `x-api-key`.
- В production не логируются запросы к `/health`.

## Конфигурация

Ключевые параметры задаются в `LoggerModule.forRootAsync`:

- `level`: берётся из переменной окружения `LOG_LEVEL`.
- `timestamp`: добавляет поле `@timestamp` в ISO 8601 UTC.
- `base`: добавляет поля `service` и `environment`.
- `transport` (только dev): `pino-pretty` с цветами, форматированием времени и сообщениями вида `[Context] message`.
- `serializers`: формируют компактные объекты `req`, `res`, `err`.
- `redact`: скрывает `req.headers.authorization` и `req.headers["x-api-key"]`.
- `customLogLevel`: 
  - `error` для 5xx или при наличии ошибки
  - `warn` для 4xx
  - `info` для остального
- `autoLogging.ignore` (prod): игнорирует пути, содержащие `/health`.

## Примеры

### Development (pretty)

```
[Bootstrap] 🚀 NestJS service is running on: http://localhost:3000/api/v1
[Bootstrap] 📊 Environment: development
[Bootstrap] 📝 Log level: debug
```

Пример запроса:

```
[TranscriptionController] Transcription request received for URL: https://example.com/audio.mp3
```

### Production (JSON)

```json
{
  "level": 30,
  "@timestamp": "2025-11-02T12:00:00.000Z",
  "service": "stt-gateway-microservice",
  "environment": "production",
  "req": { "method": "POST", "url": "/api/v1/transcriptions/file", "path": "/api/v1/transcriptions/file" },
  "res": { "statusCode": 200 },
  "msg": "request completed"
}
```

## Рекомендации

- В production используйте уровни `warn` или `error` для снижения шума.
- Не логируйте чувствительные данные в пользовательских сообщениях.
- Настройте сбор и агрегацию логов (например, ELK, Grafana Loki).
