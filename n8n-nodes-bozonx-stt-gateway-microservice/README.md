# n8n-nodes-bozonx-stt-gateway-microservice

Community-нода для n8n, выполняющая синхронную транскрибацию аудио по URL через STT Gateway Microservice (по умолчанию провайдер AssemblyAI).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

Секции:

- [Установка](#installation)
- [Использование](#использование)
- [Поля](#поля)
- [Credentials](#credentials)
- [Продвинутое](#продвинутое)
- [Совместимость](#совместимость)
- [Ресурсы](#ресурсы)

## Installation

Следуйте официальной инструкции по установке community-нод: [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Использование

Нода отправляет запрос в эндпоинт микросервиса:

```
POST {{gatewayUrl}}/api/v1/transcriptions/file
Content-Type: application/json

{
  "audioUrl": "https://example.com/audio.mp3",
  "provider": "assemblyai", // необязательно
  "timestamps": false,
  "restorePunctuation": true,
  "apiKey": "YOUR_ASSEMBLYAI_KEY" // необязательно
}
```

- `gatewayUrl` берётся из Credentials. Не включайте туда `/api/v1` — нода добавит путь сама.
- Аутентификация выполняется через Bearer токен (заголовок `Authorization: Bearer <token>`), который задаётся в Credentials.

### Пример ответа (200 OK)

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
  "timestampsEnabled": false,
  "punctuationRestored": true
}
```

## Поля

- **Audio URL** — обязательный. Публичный HTTPS URL на аудиофайл.
- **Provider** — необязательный. Если не указан, будет использован `STT_DEFAULT_PROVIDER` (например, `assemblyai`).
- **Timestamps** — чекбокс. По умолчанию выключен.
- **Restore Punctuation** — чекбокс. По умолчанию включен (если поддерживается провайдером).
- **Provider API Key** — строка, необязательно. Передаётся в провайдер, если политика сервиса позволяет кастомный ключ.

## Credentials

Креды `Bozonx Microservices API` (универсальные для всех микросервисов за API Gateway):

- **Gateway URL** — базовый URL API Gateway, без `/api/v1` (обязательное поле).
- **API Token** — токен доступа, используемый как Bearer в заголовке `Authorization` (обязательное поле).

Можно использовать выражения и переменные окружения, например:

- Gateway URL: `{{$env.API_GATEWAY_URL}}`
- API Token: `{{$env.API_TOKEN}}`

## Продвинутое

- Поддерживается настройка `Continue On Fail` в Settings ноды. При ошибке элемент вернётся с `json.error`, а выполнение продолжится для остальных элементов.
- Заголовок `Accept: application/json` установлен по умолчанию. Тело запроса — JSON.

## Совместимость

Разработано и проверено с n8n `1.60.0+`.

## Ресурсы

- Документация сервиса: `README.md` в корне репозитория.
- Документация по community-нодам n8n: https://docs.n8n.io/integrations/#community-nodes
