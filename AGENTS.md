## Agent Rules (alwaysApply)

- Microservice with REST API
- Stack: TypeScript, Hono, Docker, Cloudflare Workers
- Dual runtime: Node.js (via @hono/node-server) and Cloudflare Workers

### Structure and Practices

- Node.js: version 22
- Package manager: `pnpm`
- Node.js entrypoint: `src/entry-node.ts`
- Workers entrypoint: `src/entry-workers.ts`
- Shared app factory: `src/app.ts`
- Unit tests: `test/unit/`
- E2E tests: `test/e2e/`
- Setup of unit tests: `test/setup/unit.setup.ts`
- Guides: `docs/`
- Development stage docs: `dev_docs/`
- Update `docs/CHANGELOG.md` for significant changes
- README, all the documentation, jsdoc, messages and strings have to be in English
- Environment variables: `.env.production.example` is the source of truth for expected variables
