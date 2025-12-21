# n8n Node: Bozonx STT Gateway Microservice

Community node for n8n that performs synchronous speech-to-text transcription from a public audio URL via the STT Gateway microservice (default provider: AssemblyAI).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

Sections:

- [Installation](#installation)
- [How it works](#how-it-works)
- [Parameters](#parameters)
- [Credentials](#credentials)
- [Advanced](#advanced)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Follow the official community nodes installation guide: https://docs.n8n.io/integrations/community-nodes/installation/

## How it works

The node sends a POST request to the microservice endpoint:

```
POST {{baseUrl}}/api/v1/transcribe
Content-Type: application/json

{
  "audioUrl": "https://example.com/audio.mp3",
  "provider": "assemblyai",  
  "restorePunctuation": true,
  "language": "en",
  "formatText": true,
  "apiKey": "YOUR_ASSEMBLYAI_KEY"
}
```

- Base URL comes from Credentials. It must include protocol (http/https). The `/api/v1` path is appended automatically by the node.
- Authentication is configured in Credentials and supports None, Basic Auth, or Bearer Token.

### Example successful response (200)

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
  "punctuationRestored": true
}
```

## Parameters

- **Audio URL** (string, required)
  Public HTTP(S) URL to the audio file.

- **Provider** (options, optional)
  Speech-to-text provider. If omitted, the microservice uses its default provider. Available: `assemblyai`.

- **Restore Punctuation** (boolean)
  Ask the provider to restore punctuation when supported. Default: `true`.

- **Language** (string, optional)
  Explicit language code for the audio, e.g., `en`, `ru`, `en-US`. Value is trimmed and forwarded to the provider as-is. Leave empty to let the provider auto-detect when supported. See AssemblyAI's supported languages: https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages.

- **Format Text** (boolean)
  Whether to format text output (punctuation, capitalization). Default: `true`. When omitted the service still sends `format_text: true` to AssemblyAI.

- **Provider API Key** (string, optional)
  Direct provider API key (BYO) when allowed by service policy.

## Credentials

Use the `STT Gateway API` credentials:

  Gateway base URL without `/api/v1`. Example: `https://stt-gateway.example.com` or `http://localhost:8080`.
  If you use a custom `BASE_PATH` in the microservice, include it here: `https://api.example.com/custom-path`.

- **Authentication** (options: None, Basic Auth, Bearer Token)
  Authentication method to use. Default: None.

- **Username** and **Password** (for Basic Auth)
  Credentials for Basic authentication when selected.

- **Token** (for Bearer Token)
  Bearer token for Authorization header when selected.

You can use expressions and environment variables, e.g.:

- Base URL: `{{$env.STT_GATEWAY_URL}}`
- Token: `{{$env.STT_GATEWAY_TOKEN}}`

## Advanced

- **Continue On Fail** is supported in the node Settings. On error the item will return `{ "error": "..." }` and processing will continue for other items.
- Default headers include `Accept: application/json`. Request body is JSON.

## Compatibility

Built and tested with n8n `1.60.0+`.

## Resources

- Service docs and API reference: see the repository root `README.md` and `docs/API.md`.
- n8n community nodes docs: https://docs.n8n.io/integrations/#community-nodes
