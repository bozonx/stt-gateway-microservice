import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory';
import { saveEnvVars, restoreEnvVars } from './env-helper';

describe.skip('Authorization Disabled E2E Tests', () => {
  let app: NestFastifyApplication;
  let envSnapshot: ReturnType<typeof saveEnvVars>;

  beforeAll(() => {
    envSnapshot = saveEnvVars('AUTH_ENABLED', 'AUTH_TOKENS', 'ASSEMBLYAI_API_KEY');
  });

  beforeEach(async () => {
    process.env.AUTH_ENABLED = 'false';
    delete process.env.AUTH_TOKENS;
    process.env.ASSEMBLYAI_API_KEY = 'test-key';
    app = await createTestApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(() => {
    restoreEnvVars(envSnapshot);
  });

  describe('POST /api/v1/transcriptions/file with AUTH_ENABLED=false', () => {
    const validPayload = { audioUrl: 'https://example.com/audio.mp3', provider: 'assemblyai' };

    it('should allow access without Authorization header when auth is disabled', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/transcriptions/file', payload: validPayload });
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503);
    });

    it('should allow access with any invalid token when auth is disabled', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/transcriptions/file', headers: { authorization: 'Bearer any-random-invalid-token' }, payload: validPayload });
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503);
    });

    it('should allow access with malformed Authorization header when auth is disabled', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/transcriptions/file', headers: { authorization: 'NotBearer token' }, payload: validPayload });
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503);
    });

    it('should allow access with empty Authorization header when auth is disabled', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/transcriptions/file', headers: { authorization: '' }, payload: validPayload });
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503);
    });
  });

  describe('Public endpoints should still work', () => {
    it('GET /api/v1/health should work without authorization', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.statusCode).toBe(200);
    });

    it('GET /api/v1 should work without authorization', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('micro-stt');
    });
  });
});
