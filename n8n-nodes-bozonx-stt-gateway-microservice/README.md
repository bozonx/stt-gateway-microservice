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
POST {{gatewayUrl}}/{{basePath}}/transcriptions/file
Content-Type: application/json

{
  "audioUrl": "https://example.com/audio.mp3",
  "provider": "assemblyai",  
  "timestamps": false,
  "restorePunctuation": true,
  "apiKey": "YOUR_ASSEMBLYAI_KEY"
}
```

- `gatewayUrl` comes from Credentials. It must include protocol (http/https) and have no trailing slash.
- `basePath` is a node parameter. Leading/trailing slashes are ignored. Default: `stt/api/v1`.
- Authentication is done via the `Authorization: Bearer <token>` header provided by Credentials.

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
  "timestampsEnabled": false,
  "punctuationRestored": true
}
```

## Parameters

- **Base Path** (string)
  Default: `stt/api/v1`. Appended to the Gateway URL. Leading/trailing slashes are ignored.

- **Audio URL** (string, required)
  Public HTTPS URL to the audio file.

- **Provider** (options, optional)
  Speech-to-text provider. If omitted, the microservice uses its default provider. Available: `assemblyai`.

- **Timestamps** (boolean)
  Include word-level timestamps in provider request (if supported). Default: `false`.

- **Restore Punctuation** (boolean)
  Ask the provider to restore punctuation when supported. Default: `true`.

- **Provider API Key** (string, optional)
  Direct provider API key (BYO) when allowed by service policy.

## Credentials

Use the `Bozonx Microservices API` credentials:

- **Gateway URL** (required)
  Base URL of your API Gateway, without the base path (no trailing slash). Example: `https://api.example.com`.

- **API Token** (required)
  Bearer token added to the `Authorization` header.

You can use expressions and environment variables, e.g.:

- Gateway URL: `{{$env.API_GATEWAY_URL}}`
- API Token: `{{$env.API_TOKEN}}`

## Advanced

- **Continue On Fail** is supported in the node Settings. On error the item will return `{ "error": "..." }` and processing will continue for other items.
- Default headers include `Accept: application/json`. Request body is JSON.

## Compatibility

Built and tested with n8n `1.60.0+`.

## Resources

- Service docs and API reference: see the repository root `README.md` and `docs/API.md`.
- n8n community nodes docs: https://docs.n8n.io/integrations/#community-nodes
