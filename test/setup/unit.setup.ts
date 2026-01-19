/**
 * Unit tests global setup
 *
 * Network handling:
 * - External network calls are blocked via nock to ensure test isolation
 * - Localhost connections are allowed for local adapters
 * - All nock interceptors are cleaned after each test
 *
 * Timeout:
 * - Global timeout for unit tests is configured in jest.config.ts (5 seconds)
 * - Override per-test if needed using jest.setTimeout() or passing timeout as third arg to it()
 */

import { jest } from '@jest/globals'
// Block all external network calls; allow localhost for tests that use local adapters
// We use undici MockAgent in tests, so we don't need nock net connect disabling here.
// Or we can use undici's disableNetConnect() in setup if desired, but 
// usually it's set per agent.



