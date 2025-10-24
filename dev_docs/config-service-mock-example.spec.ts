/**
 * Example: Using createMockConfigService instead of directly manipulating process.env
 *
 * This file demonstrates best practices for mocking configuration in unit tests.
 * Instead of directly setting process.env variables, we mock the ConfigService
 * to ensure better isolation and cleaner test setup.
 */

import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createMockConfigService } from '@test/helpers/mocks';

describe('ConfigService Mock Example', () => {
  describe('❌ BAD: Direct process.env manipulation', () => {
    it('example of what NOT to do', async () => {
      // BAD: This pollutes global state
      process.env.STT_POLL_INTERVAL_MS = '100';
      process.env.STT_MAX_SYNC_WAIT_MIN = '1';

      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
      }).compile();

      const configService = moduleRef.get(ConfigService);
      const pollInterval = configService.get('STT_POLL_INTERVAL_MS');

      expect(pollInterval).toBe('100');

      // Must cleanup manually
      delete process.env.STT_POLL_INTERVAL_MS;
      delete process.env.STT_MAX_SYNC_WAIT_MIN;
    });
  });

  describe('✅ GOOD: Using createMockConfigService', () => {
    it('example of proper approach', async () => {
      // GOOD: Mock ConfigService with predefined values
      const mockConfig = createMockConfigService({
        'stt.pollIntervalMs': 100,
        'stt.maxSyncWaitMin': 1,
        'stt.requestTimeoutSec': 5,
      });

      const moduleRef = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useValue: mockConfig,
          },
        ],
      }).compile();

      const configService = moduleRef.get(ConfigService);
      const pollInterval = configService.get('stt.pollIntervalMs');

      expect(pollInterval).toBe(100);
      // No cleanup needed - mock is scoped to this test
    });

    it('example with default values', async () => {
      const mockConfig = createMockConfigService({
        'app.port': 3000,
      });

      const moduleRef = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useValue: mockConfig,
          },
        ],
      }).compile();

      const configService = moduleRef.get(ConfigService);

      // Returns configured value
      expect(configService.get('app.port')).toBe(3000);

      // Returns default value when key not configured
      expect(configService.get('app.unknown', 'default')).toBe('default');
    });

    it('example with getOrThrow', async () => {
      const mockConfig = createMockConfigService({
        'required.setting': 'value',
      });

      const moduleRef = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useValue: mockConfig,
          },
        ],
      }).compile();

      const configService = moduleRef.get<ConfigService>(ConfigService);

      // Should return configured value
      expect(configService.getOrThrow('required.setting')).toBe('value');

      // Should throw for missing required config
      expect(() => configService.getOrThrow('missing.setting')).toThrow(
        'Configuration key "missing.setting" not found',
      );
    });
  });

  describe('✅ GOOD: Overriding ConfigService in existing module', () => {
    it('example of overriding in complex module setup', async () => {
      const mockConfig = createMockConfigService({
        'app.authEnabled': false,
        'app.authTokens': [],
        'stt.pollIntervalMs': 100,
      });

      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
      })
        .overrideProvider(ConfigService)
        .useValue(mockConfig)
        .compile();

      const configService = moduleRef.get(ConfigService);

      expect(configService.get('app.authEnabled')).toBe(false);
      expect(configService.get('stt.pollIntervalMs')).toBe(100);
    });
  });
});
