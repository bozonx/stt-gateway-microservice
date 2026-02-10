/**
 * Unit tests global setup
 *
 * Network handling:
 * - Tests mock globalThis.fetch per-test to ensure isolation
 * - No external network calls should be made during unit tests
 *
 * Timeout:
 * - Global timeout for unit tests is configured in jest.config.ts (30 seconds)
 * - Override per-test if needed using jest.setTimeout() or passing timeout as third arg to it()
 */

export default function setup() {
  // No global setup needed — fetch mocking is done per-test
}
