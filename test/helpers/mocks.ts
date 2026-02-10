/**
 * Shared mock objects for tests
 *
 * This file contains reusable mock factories to avoid duplication across test files.
 * All mocks follow the DRY principle and provide type-safe implementations.
 */

import type { Logger } from '../../src/common/interfaces/logger.interface.js'
import { jest } from '@jest/globals'

/**
 * Creates a mock Logger instance with all required methods
 *
 * @returns Mock Logger with jest.fn() for all methods
 */
export const createMockLogger = (): Logger =>
  ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as Logger
