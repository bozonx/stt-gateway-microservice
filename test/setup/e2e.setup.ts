/**
 * E2E tests global setup
 *
 * Network handling:
 * - E2E tests use Hono app.request() — no real HTTP server is started
 * - External network calls may be mocked per-test if needed
 *
 * Timeout:
 * - Global timeout for e2e tests is configured in jest.config.ts (60 seconds)
 */

export default function setup() {
  // No global setup needed
}
