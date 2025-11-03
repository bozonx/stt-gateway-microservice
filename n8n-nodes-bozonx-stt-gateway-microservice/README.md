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
POST {{baseUrl}}/api/v1/transcriptions/file
Content-Type: application/json

{
  "audioUrl": "https://example.com/audio.mp3",
  "provider": "assemblyai",
  "timestamps": false,
  "apiKey": "YOUR_ASSEMBLYAI_KEY" // необязательно
}
```

- `baseUrl` берётся из Credentials. Не включайте туда `/api/v1` — нода добавит путь сама.
- Аутентификация (если нужна) — Basic (username/password) на API Gateway, сам сервис авторизацию не выполняет.

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
  "timestampsEnabled": false
}
```

## Поля

- **Audio URL** — обязательный. Публичный HTTPS URL на аудиофайл.
- **Provider** — обязательный. Список со значением `assemblyai`.
- **Timestamps** — чекбокс. По умолчанию выключен.
- **Provider API Key** — строка, необязательно. Передаётся в провайдер, если политика сервиса позволяет кастомный ключ.

## Credentials

Креды `STT Gateway API`:

- **Base URL** — базовый URL сервиса, без `/api/v1` (обязательное поле).
- **Username** — имя пользователя для Basic Auth (опционально).
- **Password** — пароль для Basic Auth (опционально).

Можно использовать выражения и переменные окружения, например:

- Base URL: `{{$env.STT_GATEWAY_BASE_URL}}`
- Username: `{{$env.STT_GATEWAY_USERNAME}}`
- Password: `{{$env.STT_GATEWAY_PASSWORD}}`

## Продвинутое

- Поддерживается настройка `Continue On Fail` в Settings ноды. При ошибке элемент вернётся с `json.error`, а выполнение продолжится для остальных элементов.
- Заголовок `Accept: application/json` установлен по умолчанию. Тело запроса — JSON.

## Совместимость

Разработано и проверено с n8n `1.60.0+`.

## Ресурсы

- Документация сервиса: `README.md` в корне репозитория.
- Документация по community-нодам n8n: https://docs.n8n.io/integrations/#community-nodes
