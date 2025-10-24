# GraphQL API Documentation

## Введение

В дополнение к REST API, сервис `micro-stt` предоставляет **GraphQL API** с поддержкой **Apollo Federation** для интеграции в API Gateway. GraphQL API выполняет ту же бизнес-логику, что и REST API, но предоставляет более гибкий способ запроса данных.

### Когда использовать GraphQL vs REST

**Используйте GraphQL, если:**

- Нужно получить только определенные поля из ответа
- Планируется интеграция в единый API Gateway
- Требуется интроспекция схемы
- Нужна типизация на клиентской стороне

**Используйте REST, если:**

- Нужна простота интеграции
- Работаете с кэшированием на уровне HTTP
- Требуется совместимость с существующими системами

## Endpoints

- **GraphQL API:** `http://localhost:3000/api/graphql`
- **Apollo Sandbox:** `http://localhost:3000/api/graphql` (только в development режиме)

## Аутентификация

GraphQL API использует ту же систему аутентификации, что и REST API:

```bash
# В HTTP headers
Authorization: Bearer YOUR_TOKEN
```

### Настройка аутентификации

Аутентификация настраивается через переменные окружения:

```bash
# Включить аутентификацию
AUTH_ENABLED=true
AUTH_TOKENS=your-token-1,your-token-2

# Отключить аутентификацию (по умолчанию)
AUTH_ENABLED=false
```

## Schema

- Query: Нет публичных запросов
- Mutation: `transcribeFile`
- Types: `TranscriptionResponse`
- Inputs: `TranscribeFileInput`

## Mutation (Мутации)

### `transcribeFile(input: TranscribeFileInput!): TranscriptionResponse`

Транскрибирует аудиофайл по URL.

**Входные параметры (`TranscribeFileInput`):**

- `audioUrl: String!` - URL аудиофайла (HTTP/HTTPS)
- `provider: String` - Провайдер STT (по умолчанию: assemblyai)
- `timestamps: Boolean` - Включить временные метки (по умолчанию: false)
- `apiKey: String` - Кастомный API ключ провайдера

**Возвращаемые данные (`TranscriptionResponse`):**

- `text: String` - Транскрибированный текст
- `provider: String` - Использованный провайдер
- `requestId: String` - ID запроса от провайдера
- `durationSec: Float` - Длительность аудио в секундах (опционально)
- `language: String` - Обнаруженный язык (опционально)
- `confidenceAvg: Float` - Средняя уверенность (0-1, опционально)
- `wordsCount: Int` - Количество слов (опционально)
- `processingMs: Int` - Время обработки в миллисекундах
- `timestampsEnabled: Boolean` - Были ли запрошены временные метки

**Пример запроса:**

```graphql
mutation ($input: TranscribeFileInput!) {
  transcribeFile(input: $input) {
    text
    provider
    processingMs
    requestId
  }
}
```

**Переменные:**

```json
{
  "input": {
    "audioUrl": "https://example.com/audio.mp3",
    "timestamps": true
  }
}
```

**Ответ:**

```json
{
  "data": {
    "transcribeFile": {
      "text": "Hello world, this is a test transcription.",
      "provider": "assemblyai",
      "processingMs": 1500,
      "requestId": "abc123-def456"
    }
  }
}
```

## Примеры использования

### cURL

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "query": "mutation($input: TranscribeFileInput!) { transcribeFile(input: $input) { text provider processingMs } }",
    "variables": {
      "input": {
        "audioUrl": "https://example.com/audio.mp3"
      }
    }
  }'
```

### JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:3000/api/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_TOKEN',
  },
  body: JSON.stringify({
    query: `
      mutation($input: TranscribeFileInput!) {
        transcribeFile(input: $input) {
          text
          provider
          processingMs
        }
      }
    `,
    variables: {
      input: {
        audioUrl: 'https://example.com/audio.mp3',
      },
    },
  }),
});

const data = await response.json();
console.log(data.data.transcribeFile.text);
```

## Обработка ошибок

GraphQL API возвращает HTTP статус `200 OK` даже при наличии ошибок. Детали ошибок содержатся в массиве `errors` в теле ответа.

### Структура ошибки

```json
{
  "errors": [
    {
      "message": "Описание ошибки",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["transcribeFile"],
      "extensions": {
        "code": "ERROR_CODE",
        "statusCode": 401
      }
    }
  ],
  "data": null
}
```

### Типичные ошибки

| Ошибка                                   | Код             | Описание                          |
| ---------------------------------------- | --------------- | --------------------------------- |
| `Missing Authorization header`           | UNAUTHORIZED    | Отсутствует заголовок авторизации |
| `Invalid authorization token`            | UNAUTHORIZED    | Неверный токен авторизации        |
| `audioUrl must be a valid URL`           | BAD_REQUEST     | Неверный формат URL               |
| `File too large`                         | BAD_REQUEST     | Файл превышает лимит размера      |
| `Private/loopback hosts are not allowed` | BAD_REQUEST     | Запрещенный хост                  |
| `Missing provider API key`               | UNAUTHORIZED    | Отсутствует API ключ провайдера   |
| `TRANSCRIPTION_TIMEOUT`                  | GATEWAY_TIMEOUT | Превышено время ожидания          |

## Apollo Federation

Сервис готов к интеграции в **Apollo Gateway** для построения единого API из нескольких микросервисов.

### Конфигурация Gateway

```javascript
const { ApolloGateway } = require('@apollo/gateway');

const gateway = new ApolloGateway({
  serviceList: [
    { name: 'micro-stt', url: 'http://localhost:3000/api/graphql' },
    // другие микросервисы...
  ],
});
```

### Federation Schema

Сервис автоматически предоставляет federation schema через introspection:

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ _service { sdl } }"}'
```

## Интроспекция

Для получения полной схемы GraphQL:

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ __schema { types { name } } }"}'
```

## Сравнение с REST API

| Функция            | REST API                      | GraphQL API               |
| ------------------ | ----------------------------- | ------------------------- |
| **Эндпоинт**       | `/api/v1/transcriptions/file` | `/api/graphql`            |
| **Метод**          | POST                          | POST                      |
| **Аутентификация** | Bearer Token                  | Bearer Token              |
| **Формат запроса** | JSON body                     | GraphQL query             |
| **Формат ответа**  | JSON                          | JSON                      |
| **Типизация**      | DTOs                          | GraphQL Schema            |
| **Валидация**      | class-validator               | GraphQL + class-validator |

### Примеры эквивалентных запросов

**REST:**

```bash
curl -X POST http://localhost:3000/api/v1/transcriptions/file \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "audioUrl": "https://example.com/audio.mp3",
    "timestamps": true
  }'
```

**GraphQL:**

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "query": "mutation($input: TranscribeFileInput!) { transcribeFile(input: $input) { text provider } }",
    "variables": { "input": { "audioUrl": "https://example.com/audio.mp3", "timestamps": true } }
  }'
```

---

**Версия документации:** 0.14.0  
**Последнее обновление:** 2025-10-23
