# Development Guide

This guide describes how to develop and test the STT Gateway Microservice.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Wrangler (for Cloudflare Workers)

## Development Scripts

### Node.js (Local)

To run the service locally using Node.js:

```bash
pnpm start:dev
```

This uses `tsx` and watches for changes in `src/entry-node.ts`. It loads variables from `.env.development`.

### Cloudflare Workers

To run the service locally as a Cloudflare Worker:

```bash
pnpm start:worker:dev
```

This uses `wrangler dev` and watches for changes in `src/entry-workers.ts`. It loads variables from `.dev.vars` and listens on port 8086.

## Testing

- `pnpm test`: Run all tests
- `pnpm test:unit`: Run only unit tests
- `pnpm test:e2e`: Run only end-to-end tests

## Environment Variables

- `.env.development`: Variables for Node.js development.
- `.dev.vars`: Variables for Cloudflare Workers local development (Wrangler).
- `.env.production.example`: Reference for all available variables.
