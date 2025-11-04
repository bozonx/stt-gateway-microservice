# Development guide (dev)

## Requirements

- Node.js 22+
- pnpm 10+

## Quick start (dev)

```bash
# 1) Install dependencies
pnpm install

# 2) Environment (dev)
cp env.development.example .env.development

# 3) Start in watch mode
pnpm start:dev
```

- Default URL (dev): `http://localhost:3000/api/v1`

## Tests

Jest projects are split into `unit` and `e2e`.

```bash
# All tests
pnpm test

# Unit tests
pnpm test:unit

# E2E tests
pnpm test:e2e

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov

# Debug
pnpm test:unit:debug
pnpm test:e2e:debug
```

## Code quality

```bash
# Lint
pnpm lint

# Format
pnpm format
```

## Good to know

- Global `ValidationPipe` enabled (whitelist, forbidNonWhitelisted, transform).
- `pino-pretty` for more readable logs in dev.
- Autologging of `/health` is disabled in prod, enabled in dev.
- Sensitive headers are redacted in logs (`authorization`, `x-api-key`).
- TypeScript/Jest path aliases: `@/*`, `@common/*`, `@modules/*`, `@config/*`, `@test/*`.
